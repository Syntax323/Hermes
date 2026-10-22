const http = require("http");
const fs = require("fs");
const path = require("path");
const clients = new Set();

const server = http.createServer((req, res) => {

    // GET messages
    if (req.url === "/messages.json" && req.method === "GET") {
        fs.readFile("messages.json", "utf8", (err, data) => {

            if (err) {
                console.log("Error reading messages.json:", err);

                res.writeHead(500, {
                    "Content-Type": "text/plain"
                });

                res.end("Error reading messages");
                return;
            }

            res.writeHead(200, {
                "Content-Type": "application/json"
            });

            res.end(data);
        });

        return;
    }


    // POST message
    if (req.url === "/messages.json" && req.method === "POST") {

        let body = "";

        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", () => {
            const newMessage = JSON.parse(body);

            const messages = JSON.parse(
                fs.readFileSync("messages.json", "utf8")
            );

            messages.push(newMessage);

            fs.writeFileSync(
                "messages.json",
                JSON.stringify(messages, null, 4)
            );

            res.writeHead(200, {
                "Content-Type": "application/json"
            });

            res.end(JSON.stringify({
                success: true
            }));

            for (const client of clients) {
                client.write(
                    `data: ${JSON.stringify(newMessage)}\n\n`
                );
            }

        });

        return;
    }

    
if (req.url === "/friends" && req.method === "POST") {
    let body = "";

    req.on("data", chunk => {
        body += chunk;
    });

    req.on("end", () => {
        try {
            const data = JSON.parse(body);
            const usersFile = path.join(__dirname, "users.json");

            const users = JSON.parse(
                fs.readFileSync(usersFile, "utf8")
            );

            const currentUser = users.find(
                user => user.username === data.username
            );

            const friendUser = users.find(
                user => user.username.toLowerCase() ===
                        data.friend.trim().toLowerCase()
            );

            if (!currentUser) {
                res.writeHead(404, {
                    "Content-Type": "application/json"
                });
                res.end(JSON.stringify({
                    message: "User not found."
                }));
                return;
            }

            if (!friendUser) {
                res.writeHead(404, {
                    "Content-Type": "application/json"
                });
                res.end(JSON.stringify({
                    message: "That username does not exist."
                }));
                return;
            }

            if (currentUser.username === friendUser.username) {
                res.writeHead(400, {
                    "Content-Type": "application/json"
                });
                res.end(JSON.stringify({
                    message: "You cannot add yourself."
                }));
                return;
            }

            if (!currentUser.friends) {
                currentUser.friends = [];
            }

            const alreadyFriend = currentUser.friends.some(
                friend => friend.toLowerCase() ===
                          friendUser.username.toLowerCase()
            );

            if (alreadyFriend) {
                res.writeHead(200, {
                    "Content-Type": "application/json"
                });
                res.end(JSON.stringify({
                    message: "Already friends with " +
                             friendUser.username + "."
                }));
                return;
            }

            currentUser.friends.push(friendUser.username);

            fs.writeFileSync(
                usersFile,
                JSON.stringify(users, null, 4)
            );

            res.writeHead(200, {
                "Content-Type": "application/json"
            });
            res.end(JSON.stringify({
                message: "Added " + friendUser.username +
                        " to your friends list."
            }));

            // Tell connected clients that the friends list changed
            for (const client of clients) {
                client.write(`event: friendAdded\ndata: ${JSON.stringify({
                    username: currentUser.username,
                    friend: friendUser.username
                })}\n\n`);
            }

        } catch (error) {
            console.error("Friend command error:", error);

            res.writeHead(400, {
                "Content-Type": "application/json"
            });
            res.end(JSON.stringify({
                message: "Could not add friend."
            }));
        }
        
    });

    return;
}


    if (req.url === "/users.json" && req.method === "POST") {
        let body = "";

        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", () => {
            try {
                const newAccount = JSON.parse(body);

                const usersFile = path.join(__dirname, "users.json");

                const users = JSON.parse(
                    fs.readFileSync(usersFile, "utf8")
                );

                users.push(newAccount);

                fs.writeFileSync(
                    usersFile,
                    JSON.stringify(users, null, 4)
                );

                res.writeHead(200, {
                    "Content-Type": "application/json"
                });

                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                console.error("Error saving account:", error);

                res.writeHead(500, {
                    "Content-Type": "application/json"
                });

                res.end(JSON.stringify({
                    success: false,
                    error: "Could not save account"
                }));
            }
        });

        return;
    }


    // Serve files from public
    let filePath;

    if (req.url === "/") {
        filePath = "public/index.html";
    } else {
        filePath = req.url.substring(1);
    }

    if (req.url === "/events") {
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        });

        res.write("\n");
        clients.add(res);

        req.on("close", () => {
            clients.delete(res);
        });

        return;
    }

    fs.readFile(filePath, (err, data) => {

        if (err) {
            console.log("File not found:", filePath);

            res.writeHead(404);
            res.end("File not found");
            return;
        }

        res.writeHead(200);
        res.end(data);
    });
    
    if (req.path === '/.well-known/appspecific/com.chrome.devtools.json') {
        return res.status(204).end();
    }
});


server.listen(3000, () => {
    console.log("Server running at http://127.0.0.1:3000");
});