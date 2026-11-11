
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const clients = new Map();

const usersFile = path.join(__dirname, "users.json");
const messagesFile = path.join(__dirname, "messages.json");
const roomsFile = path.join(__dirname, "rooms.json");
const publicFolder = path.join(__dirname, "public");

// =========================
// JSON FILE FUNCTIONS
// =========================

function readJson(file, fallback = []) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(fallback, null, 4));
    }

    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 4));
}

function sendJson(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify(data));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk;

            if (body.length > 100000) {
                reject(new Error("Request body too large"));
                req.destroy();
            }
        });

        req.on("end", () => {
            try {
                resolve(JSON.parse(body || "{}"));
            } catch {
                reject(new Error("Invalid JSON"));
            }
        });

        req.on("error", reject);
    });
}

// =========================
// USER FUNCTIONS
// =========================

function getUsername(req) {
    const cookies = req.headers.cookie || "";

    const usernameCookie = cookies
        .split(";")
        .find(cookie => cookie.trim().startsWith("Username="));

    if (!usernameCookie) return null;

    return decodeURIComponent(
        usernameCookie.trim().substring("Username=".length)
    );
}

function findUser(users, username) {
    if (!username) return undefined;

    return users.find(user =>
        user.username.toLowerCase() === String(username).toLowerCase()
    );
}

function setProfileDefaults(user) {
    user.theme = user.theme || "theme0";
    user.pfp = user.pfp || "pfp0";
    user.namecolor = user.namecolor || "#ffffff";
}

function validHexColor(color) {
    return typeof color === "string" &&
        /^#[0-9a-fA-F]{6}$/.test(color);
}

// =========================
// ROOM FUNCTIONS
// =========================

function findConversation(rooms, id) {
    return rooms.find(room => room.id === id);
}

function isBanned(conversation, username) {
    if (!conversation || !username) return false;

    return (conversation.bannedMembers || []).some(member =>
        member.toLowerCase() === username.toLowerCase()
    );
}

function canAccess(conversation, username) {
    if (!conversation || !username) return false;

    if (isBanned(conversation, username)) {
        return false;
    }

    if (conversation.type === "room" && !conversation.isPrivate) {
        return true;
    }

    return conversation.members.some(member =>
        member.toLowerCase() === username.toLowerCase()
    );
}

// =========================
// SSE FUNCTIONS
// =========================

function notifyUsers(usernames, eventName, data) {
    for (const [client, clientUsername] of clients) {
        const allowed = usernames.some(username =>
            username.toLowerCase() === clientUsername.toLowerCase()
        );

        if (allowed) {
            client.write(
                `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`
            );
        }
    }
}

function notifyConversation(conversation, eventName, data) {
    notifyUsers(conversation.members, eventName, data);
}

// =========================
// DIRECT MESSAGE ID
// =========================

function createDmId(user1, user2) {
    const names = [
        user1.toLowerCase(),
        user2.toLowerCase()
    ].sort();

    const hash = crypto
        .createHash("sha256")
        .update(names.join(":"))
        .digest("hex")
        .slice(0, 20);

    return "dm-" + hash;
}

// =========================
// SERVER
// =========================

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const route = url.pathname;

    try {

        // =========================
        // SERVER-SENT EVENTS
        // =========================

        if (route === "/events" && req.method === "GET") {
            const username = getUsername(req);

            if (!username) {
                return sendJson(res, 401, {
                    message: "You must be logged in."
                });
            }

            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            });

            res.write("\n");

            clients.set(res, username);

            req.on("close", () => {
                clients.delete(res);
            });

            return;
        }

        // =========================
        // USERS
        // =========================

        if (route === "/users.json" && req.method === "GET") {
            // This still returns complete user records because the
            // current login code may depend on this route.
            // Move login checks to a server-side login API later.
            return sendJson(res, 200, readJson(usersFile));
        }

        if (route === "/users.json" && req.method === "POST") {
            const newAccount = await readBody(req);
            const users = readJson(usersFile);

            if (!newAccount.username) {
                return sendJson(res, 400, {
                    message: "Username is required."
                });
            }

            if (findUser(users, newAccount.username)) {
                return sendJson(res, 409, {
                    message: "Username already exists."
                });
            }

            newAccount.friends = newAccount.friends || [];
            newAccount.theme = "theme0";
            newAccount.pfp = "pfp0";
            newAccount.namecolor = "#ffffff";

            users.push(newAccount);
            writeJson(usersFile, users);

            return sendJson(res, 200, {
                success: true
            });
        }

        // =========================
        // USER PROFILE
        // =========================

        if (route === "/api/profile" && req.method === "GET") {
            const username = url.searchParams.get("username");
            const users = readJson(usersFile);
            const user = findUser(users, username);

            if (!user) {
                return sendJson(res, 404, {
                    message: "User not found."
                });
            }

            setProfileDefaults(user);
            writeJson(usersFile, users);

            return sendJson(res, 200, {
                username: user.username,
                theme: user.theme,
                pfp: user.pfp,
                namecolor: user.namecolor
            });
        }

        if (route === "/api/profile" && req.method === "PUT") {
            const data = await readBody(req);
            const users = readJson(usersFile);
            const user = findUser(users, data.username);

            if (!user) {
                return sendJson(res, 404, {
                    message: "User not found."
                });
            }

            const validThemes = [
                "theme0",
                "theme1",
                "theme2"
            ];

            const validPfps = Array.from(
                { length: 24 },
                (_, index) => "pfp" + index
            );

            if (!validThemes.includes(data.theme)) {
                return sendJson(res, 400, {
                    message: "Invalid theme."
                });
            }

            if (!validPfps.includes(data.pfp)) {
                return sendJson(res, 400, {
                    message: "Invalid profile picture."
                });
            }

            if (!validHexColor(data.namecolor)) {
                return sendJson(res, 400, {
                    message: "Name color must be a six-digit hex color."
                });
            }

            user.theme = data.theme;
            user.pfp = data.pfp;
            user.namecolor = data.namecolor;

            writeJson(usersFile, users);

            return sendJson(res, 200, {
                message: "Profile updated.",
                profile: {
                    theme: user.theme,
                    pfp: user.pfp,
                    namecolor: user.namecolor
                }
            });
        }

        // =========================
        // FRIENDS
        // =========================

        if (route === "/friends" &&
            (req.method === "POST" || req.method === "DELETE")) {

            const data = await readBody(req);
            const users = readJson(usersFile);

            const currentUser = findUser(users, data.username);
            const friendUser = findUser(users, data.friend);

            if (!currentUser || !friendUser) {
                return sendJson(res, 404, {
                    message: "User not found."
                });
            }

            if (currentUser.username.toLowerCase() ===
                friendUser.username.toLowerCase()) {
                return sendJson(res, 400, {
                    message: "You cannot add or remove yourself."
                });
            }

            currentUser.friends = currentUser.friends || [];

            const alreadyFriend = currentUser.friends.some(friend =>
                friend.toLowerCase() === friendUser.username.toLowerCase()
            );

            if (req.method === "POST") {
                if (alreadyFriend) {
                    return sendJson(res, 200, {
                        message: "Already friends with " +
                            friendUser.username + "."
                    });
                }

                currentUser.friends.push(friendUser.username);

            } else {
                if (!alreadyFriend) {
                    return sendJson(res, 404, {
                        message: "Friend not found."
                    });
                }

                currentUser.friends = currentUser.friends.filter(friend =>
                    friend.toLowerCase() !== friendUser.username.toLowerCase()
                );
            }

            writeJson(usersFile, users);

            const eventName = req.method === "POST"
                ? "friendAdded"
                : "friendRemoved";

            notifyUsers(
                [currentUser.username],
                eventName,
                {
                    username: currentUser.username,
                    friend: friendUser.username
                }
            );

            return sendJson(res, 200, {
                message: req.method === "POST"
                    ? "Added " + friendUser.username + " to your friends list."
                    : "Removed " + friendUser.username + " from your friends list."
            });
        }

        // =========================
        // GET ROOMS AND DMS
        // =========================

        if (route === "/api/rooms" && req.method === "GET") {
            const username = url.searchParams.get("username");

            if (!username) {
                return sendJson(res, 400, {
                    message: "Username is required."
                });
            }

            const rooms = readJson(roomsFile);

            const availableRooms = rooms.filter(room =>
                room.type === "room" &&
                !isBanned(room, username) &&
                (
                    !room.isPrivate ||
                    room.members.some(member =>
                        member.toLowerCase() === username.toLowerCase()
                    )
                )
            );

            const directMessages = rooms.filter(room =>
                room.type === "dm" &&
                room.members.some(member =>
                    member.toLowerCase() === username.toLowerCase()
                )
            );

            return sendJson(res, 200, {
                rooms: availableRooms,
                directMessages: directMessages
            });
        }

        // =========================
        // CREATE ROOM
        // =========================

        if (route === "/api/rooms" && req.method === "POST") {
            const data = await readBody(req);
            const rooms = readJson(roomsFile);
            const users = readJson(usersFile);

            const currentUser = findUser(users, data.username);

            if (!currentUser) {
                return sendJson(res, 404, {
                    message: "User not found."
                });
            }

            const name = String(data.name || "").trim();

            if (!name || name.length > 40) {
                return sendJson(res, 400, {
                    message: "Room name must contain 1 to 40 characters."
                });
            }

            const room = {
                id: "room-" + crypto.randomUUID(),
                type: "room",
                name: name,
                owner: currentUser.username,
                members: [currentUser.username],
                bannedMembers: [],
                isPrivate: data.isPrivate === true
            };

            rooms.push(room);
            writeJson(roomsFile, rooms);

            notifyUsers(
                [currentUser.username],
                "roomChanged",
                { action: "created", room: room }
            );

            return sendJson(res, 201, {
                message: "Room created.",
                room: room
            });
        }

        // =========================
        // JOIN PUBLIC ROOM
        // =========================

        const joinMatch = route.match(/^\/api\/rooms\/([^/]+)\/join$/);

        if (joinMatch && req.method === "POST") {
            const data = await readBody(req);
            const rooms = readJson(roomsFile);
            const users = readJson(usersFile);

            const room = findConversation(rooms, joinMatch[1]);
            const user = findUser(users, data.username);

            if (!room || room.type !== "room") {
                return sendJson(res, 404, {
                    message: "Room not found."
                });
            }

            if (!user) {
                return sendJson(res, 404, {
                    message: "User not found."
                });
            }

            if (isBanned(room, user.username)) {
                return sendJson(res, 403, {
                    message: "You have been removed from this room."
                });
            }

            if (room.isPrivate) {
                return sendJson(res, 403, {
                    message: "You cannot join a private room."
                });
            }

            if (!room.members.some(member =>
                member.toLowerCase() === user.username.toLowerCase()
            )) {
                room.members.push(user.username);
                writeJson(roomsFile, rooms);
            }

            notifyUsers(
                room.members,
                "roomChanged",
                { action: "joined", room: room }
            );

            return sendJson(res, 200, {
                message: "Joined room.",
                room: room
            });
        }

        // =========================
        // ADD OR REMOVE ROOM MEMBERS
        // =========================

        const membersMatch = route.match(
            /^\/api\/rooms\/([^/]+)\/members$/
        );

        if (membersMatch &&
            (req.method === "POST" || req.method === "DELETE")) {

            const data = await readBody(req);
            const rooms = readJson(roomsFile);
            const users = readJson(usersFile);

            const room = findConversation(rooms, membersMatch[1]);
            const currentUser = findUser(users, data.username);
            const targetUser = findUser(users, data.member);

            if (!room || room.type !== "room") {
                return sendJson(res, 404, {
                    message: "Room not found."
                });
            }

            if (!currentUser ||
                currentUser.username.toLowerCase() !== room.owner.toLowerCase()) {
                return sendJson(res, 403, {
                    message: "Only the room owner can manage members."
                });
            }

            if (!targetUser) {
                return sendJson(res, 404, {
                    message: "User not found."
                });
            }

            const targetName = targetUser.username;

            if (req.method === "POST") {
                if (!room.members.some(member =>
                    member.toLowerCase() === targetName.toLowerCase()
                )) {
                    room.members.push(targetName);
                }

                room.bannedMembers = (room.bannedMembers || []).filter(member =>
                    member.toLowerCase() !== targetName.toLowerCase()
                );

            } else {
                if (targetName.toLowerCase() === room.owner.toLowerCase()) {
                    return sendJson(res, 400, {
                        message: "The room owner cannot be removed."
                    });
                }

                room.members = room.members.filter(member =>
                    member.toLowerCase() !== targetName.toLowerCase()
                );

                room.bannedMembers = room.bannedMembers || [];

                if (!room.bannedMembers.some(member =>
                    member.toLowerCase() === targetName.toLowerCase()
                )) {
                    room.bannedMembers.push(targetName);
                }
            }

            writeJson(roomsFile, rooms);

            notifyUsers(
                [...room.members, targetName],
                "roomChanged",
                {
                    action: req.method === "POST"
                        ? "memberAdded"
                        : "memberRemoved",
                    room: room,
                    member: targetName
                }
            );

            return sendJson(res, 200, {
                message: req.method === "POST"
                    ? "Added " + targetName + " to the room."
                    : "Removed " + targetName + " from the room.",
                room: room
            });
        }

        // =========================
        // DELETE ROOM
        // =========================

        const roomMatch = route.match(/^\/api\/rooms\/([^/]+)$/);

        if (roomMatch && req.method === "DELETE") {
            const data = await readBody(req);
            const rooms = readJson(roomsFile);

            const room = findConversation(rooms, roomMatch[1]);

            if (!room || room.type !== "room") {
                return sendJson(res, 404, {
                    message: "Room not found."
                });
            }

            if (String(data.username).toLowerCase() !==
                room.owner.toLowerCase()) {
                return sendJson(res, 403, {
                    message: "Only the room owner can delete this room."
                });
            }

            const members = [...room.members];

            const updatedRooms = rooms.filter(item =>
                item.id !== room.id
            );

            writeJson(roomsFile, updatedRooms);

            notifyUsers(
                members,
                "roomChanged",
                {
                    action: "deleted",
                    roomId: room.id
                }
            );

            return sendJson(res, 200, {
                message: "Room deleted."
            });
        }

        // =========================
        // CREATE OR OPEN DIRECT MESSAGE
        // =========================

        if (route === "/api/direct-messages" && req.method === "POST") {
            const data = await readBody(req);
            const users = readJson(usersFile);
            const rooms = readJson(roomsFile);

            const currentUser = findUser(users, data.username);
            const friendUser = findUser(users, data.friend);

            if (!currentUser || !friendUser) {
                return sendJson(res, 404, {
                    message: "User not found."
                });
            }

            currentUser.friends = currentUser.friends || [];

            const isFriend = currentUser.friends.some(friend =>
                friend.toLowerCase() === friendUser.username.toLowerCase()
            );

            if (!isFriend) {
                return sendJson(res, 403, {
                    message: "You must add this user as a friend first."
                });
            }

            const id = createDmId(
                currentUser.username,
                friendUser.username
            );

            let conversation = findConversation(rooms, id);

            if (!conversation) {
                conversation = {
                    id: id,
                    type: "dm",
                    name: friendUser.username,
                    owner: null,
                    members: [
                        currentUser.username,
                        friendUser.username
                    ],
                    isPrivate: true
                };

                rooms.push(conversation);
                writeJson(roomsFile, rooms);

                notifyUsers(
                    conversation.members,
                    "conversationCreated",
                    conversation
                );
            }

            return sendJson(res, 200, {
                message: "Direct message opened.",
                conversation: conversation
            });
        }

        // =========================
        // GET CONVERSATION MESSAGES
        // =========================

        if (route === "/api/messages" && req.method === "GET") {
            const username = url.searchParams.get("username");
            const conversationId = url.searchParams.get("conversationId");

            const rooms = readJson(roomsFile);
            const conversation = findConversation(rooms, conversationId);

            if (!canAccess(conversation, username)) {
                return sendJson(res, 403, {
                    message: "You cannot access this conversation."
                });
            }

            const messages = readJson(messagesFile);

            const conversationMessages = messages.filter(message =>
                message.conversationId === conversationId
            );

            return sendJson(res, 200, conversationMessages);
        }

        // =========================
        // SEND MESSAGE
        // =========================

        if (route === "/api/messages" && req.method === "POST") {
            const data = await readBody(req);

            const rooms = readJson(roomsFile);
            const conversation = findConversation(
                rooms,
                data.conversationId
            );

            if (!canAccess(conversation, data.username)) {
                return sendJson(res, 403, {
                    message: "You cannot send messages to this conversation."
                });
            }

            const messageText = String(data.message || "").trim();

            if (!messageText || messageText.length > 5000) {
                return sendJson(res, 400, {
                    message: "Message must contain 1 to 5000 characters."
                });
            }

            const users = readJson(usersFile);
            const user = findUser(users, data.username);

            if (!user) {
                return sendJson(res, 404, {
                    message: "User not found."
                });
            }

            setProfileDefaults(user);

            const newMessage = {
                username: user.username,
                message: messageText,
                conversationId: conversation.id,
                pfp: user.pfp,
                namecolor: user.namecolor,
                time: new Date().toISOString()
            };

            const messages = readJson(messagesFile);
            messages.push(newMessage);
            writeJson(messagesFile, messages);
            writeJson(usersFile, users);

            notifyConversation(
                conversation,
                "message",
                newMessage
            );

            return sendJson(res, 200, {
                success: true,
                message: newMessage
            });
        }

        // =========================
        // UNKNOWN API ROUTES
        // =========================

        if (route.startsWith("/api/")) {
            return sendJson(res, 404, {
                message: "API endpoint not found."
            });
        }

        // =========================
        // STATIC FILES
        // =========================

        const requestedPath = route === "/"
            ? "index.html"
            : decodeURIComponent(route.substring(1));

        const filePath = path.resolve(publicFolder, requestedPath);

        if (!filePath.startsWith(publicFolder + path.sep) &&
            filePath !== path.join(publicFolder, "index.html")) {
            return sendJson(res, 403, {
                message: "Access denied."
            });
        }

        fs.readFile(filePath, (err, fileData) => {
            if (err) {
                res.writeHead(404);
                res.end("File not found");
                return;
            }

            const ext = path.extname(filePath);

            const contentTypes = {
                ".html": "text/html",
                ".css": "text/css",
                ".js": "application/javascript",
                ".json": "application/json",
                ".png": "image/png",
                ".webp": "image/webp",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".avif": "image/avif",
                ".svg": "image/svg+xml",
                ".ico": "image/x-icon"
            };

            res.writeHead(200, {
                "Content-Type": contentTypes[ext] ||
                    "application/octet-stream"
            });

            res.end(fileData);
        });

    } catch (error) {
        console.error("Server error:", error);

        if (!res.headersSent) {
            sendJson(res, 400, {
                message: error.message || "Request failed."
            });
        } else {
            res.end();
        }
    }
});

server.listen(3000, () => {
    console.log("Server running at http://127.0.0.1:3000");
});
