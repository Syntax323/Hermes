
var username;
var theme;
var pfp;
var namecolor;

var currentConversation = null;
var allRooms = [];
var allDirectMessages = [];
var allFriends = [];

const typing = document.getElementById("typing");
const chat = document.getElementById("chat");

const events = new EventSource("/events");

// =========================
// INITIALIZATION
// =========================

window.addEventListener("DOMContentLoaded", async function() {
    username = getCookie("Username");

    if (!username) {
        window.location.href = "index.html";
        return;
    }

    try {
        await loadProfile();

        typing.placeholder = "Typing as: " + username;

        await friendsList();
        await loadRooms();

        document.getElementById("create-room")
            .addEventListener("click", createRoom);

        document.getElementById("delete-room")
            .addEventListener("click", deleteRoom);

        document.getElementById("add-member")
            .addEventListener("click", addMember);

    } catch (error) {
        console.error("Initialization error:", error);
        alert(error.message);
    }
});

// =========================
// COOKIES
// =========================

function getCookie(name) {
    const cookieArr = document.cookie.split(";");

    for (const cookie of cookieArr) {
        const cookiePair = cookie.split("=");

        if (name === cookiePair[0].trim()) {
            return decodeURIComponent(
                cookiePair.slice(1).join("=")
            );
        }
    }

    return null;
}

// =========================
// API HELPER
// =========================

async function apiRequest(url, method = "GET", data = null) {
    const options = {
        method: method,
        headers: {
            "Content-Type": "application/json"
        }
    };

    if (data !== null) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Request failed.");
    }

    return result;
}

// =========================
// LOAD USER PROFILE
// =========================

async function loadProfile() {
    const profile = await apiRequest(
        "/api/profile?username=" + encodeURIComponent(username)
    );

    theme = profile.theme;
    pfp = profile.pfp;
    namecolor = profile.namecolor;

    const themeLocation = document.getElementById("theme");

    if (themeLocation) {
        themeLocation.href = "themes/" + theme + ".css";
    }
}

// =========================
// LOAD ROOMS AND DMS
// =========================

async function loadRooms() {
    try {
        const data = await apiRequest(
            "/api/rooms?username=" + encodeURIComponent(username)
        );

        allRooms = data.rooms || [];
        allDirectMessages = data.directMessages || [];

        displayRooms();
        displayDirectMessages();

        // Keep the selected conversation if it is still available.
        if (currentConversation) {
            const updatedConversation = [
                ...allRooms,
                ...allDirectMessages
            ].find(item => item.id === currentConversation.id);

            if (updatedConversation) {
                currentConversation = updatedConversation;
                updateConversationControls();
                return;
            }

            // The selected conversation is no longer available.
            currentConversation = null;
            chat.replaceChildren();
        }

        const firstConversation =
            allRooms[0] || allDirectMessages[0];

        if (firstConversation) {
            await selectConversation(firstConversation);
        } else {
            chat.replaceChildren();

            document.getElementById("conversation-title")
                .textContent = "No conversations";

            document.getElementById("room-members-panel").hidden = true;
            document.getElementById("delete-room").hidden = true;

            typing.disabled = true;
            document.getElementById("send-button").disabled = true;
        }

    } catch (error) {
        console.error("Error loading conversations:", error);
    }
}

// =========================
// DISPLAY ROOMS
// =========================

function displayRooms() {
    const container = document.getElementById("rooms");

    container.replaceChildren();

    allRooms.forEach(room => {
        const button = document.createElement("button");

        button.className = "conversation-button";

        if (currentConversation &&
            currentConversation.id === room.id) {
            button.classList.add("selected");
        }

        button.textContent =
            room.name + (room.isPrivate ? " (Private)" : "");

        button.addEventListener("click", async function() {
            await selectConversation(room);
        });

        container.appendChild(button);
    });
}

// =========================
// DISPLAY DIRECT MESSAGES
// =========================

function displayDirectMessages() {
    const container = document.getElementById("direct-messages");

    container.replaceChildren();

    allDirectMessages.forEach(conversation => {
        const otherUser = conversation.members.find(member =>
            member.toLowerCase() !== username.toLowerCase()
        );

        const button = document.createElement("button");

        button.className = "conversation-button";
        button.textContent = otherUser || "Unknown user";

        if (currentConversation &&
            currentConversation.id === conversation.id) {
            button.classList.add("selected");
        }

        button.addEventListener("click", async function() {
            await selectConversation(conversation);
        });

        container.appendChild(button);
    });
}

// =========================
// SELECT CONVERSATION
// =========================

async function selectConversation(conversation) {
    try {
        // Join a public room if the user is not already a member.
        if (conversation.type === "room" &&
            !conversation.members.some(member =>
                member.toLowerCase() === username.toLowerCase()
            )) {

            const result = await apiRequest(
                "/api/rooms/" +
                encodeURIComponent(conversation.id) +
                "/join",
                "POST",
                {
                    username: username
                }
            );

            conversation = result.room;
        }

        currentConversation = conversation;

        displayRooms();
        displayDirectMessages();

        updateConversationControls();

        await loadMessages();

    } catch (error) {
        console.error("Error selecting conversation:", error);
        alert(error.message);

        await loadRooms();
    }
}

// =========================
// CONVERSATION CONTROLS
// =========================

function updateConversationControls() {
    if (!currentConversation) return;

    const title = document.getElementById("conversation-title");
    const deleteButton = document.getElementById("delete-room");
    const membersPanel = document.getElementById("room-members-panel");
    const addButton = document.getElementById("add-member");

    const isRoom = currentConversation.type === "room";

    if (isRoom) {
        title.textContent = currentConversation.name;

        const isOwner =
            currentConversation.owner.toLowerCase() === username.toLowerCase();

        deleteButton.hidden = !isOwner;
        membersPanel.hidden = false;
        addButton.hidden = !isOwner;

        displayMembers();

    } else {
        const otherUser = currentConversation.members.find(member =>
            member.toLowerCase() !== username.toLowerCase()
        );

        title.textContent = "Direct message: " + otherUser;

        deleteButton.hidden = true;
        membersPanel.hidden = true;
    }

    typing.disabled = false;
    document.getElementById("send-button").disabled = false;

    typing.placeholder = "Message " + title.textContent + "...";
}

// =========================
// DISPLAY ROOM MEMBERS
// =========================

function displayMembers() {
    const container = document.getElementById("room-members");

    container.replaceChildren();

    if (!currentConversation ||
        currentConversation.type !== "room") {
        return;
    }

    const isOwner =
        currentConversation.owner.toLowerCase() === username.toLowerCase();

    currentConversation.members.forEach(member => {
        const row = document.createElement("div");
        row.className = "member-row";

        const name = document.createElement("span");
        name.textContent = member;

        row.appendChild(name);

        if (isOwner &&
            member.toLowerCase() !== currentConversation.owner.toLowerCase()) {

            const removeButton = document.createElement("button");

            removeButton.textContent = "Remove";

            removeButton.addEventListener("click", function() {
                removeMember(member);
            });

            row.appendChild(removeButton);
        }

        container.appendChild(row);
    });
}

// =========================
// CREATE ROOM
// =========================

async function createRoom() {
    const name = prompt("Enter a room name:");

    if (!name || !name.trim()) return;

    const isPrivate = confirm(
        "Make this a private room?\n\nOK = Private\nCancel = Public"
    );

    try {
        const result = await apiRequest(
            "/api/rooms",
            "POST",
            {
                username: username,
                name: name.trim(),
                isPrivate: isPrivate
            }
        );

        await loadRooms();
        await selectConversation(result.room);

    } catch (error) {
        console.error("Error creating room:", error);
        alert(error.message);
    }
}

// =========================
// DELETE ROOM
// =========================

async function deleteRoom() {
    if (!currentConversation ||
        currentConversation.type !== "room") {
        return;
    }

    const confirmed = confirm(
        "Are you sure you want to delete " +
        currentConversation.name + "?"
    );

    if (!confirmed) return;

    try {
        await apiRequest(
            "/api/rooms/" + encodeURIComponent(currentConversation.id),
            "DELETE",
            {
                username: username
            }
        );

        currentConversation = null;
        chat.replaceChildren();

        await loadRooms();

    } catch (error) {
        console.error("Error deleting room:", error);
        alert(error.message);
    }
}

// =========================
// ADD ROOM MEMBER
// =========================

async function addMember() {
    if (!currentConversation) return;

    const member = prompt("Enter the username to add:");

    if (!member || !member.trim()) return;

    try {
        const result = await apiRequest(
            "/api/rooms/" +
            encodeURIComponent(currentConversation.id) +
            "/members",
            "POST",
            {
                username: username,
                member: member.trim()
            }
        );

        currentConversation = result.room;

        updateConversationControls();
        await loadRooms();

    } catch (error) {
        console.error("Error adding room member:", error);
        alert(error.message);
    }
}

// =========================
// REMOVE ROOM MEMBER
// =========================

async function removeMember(member) {
    if (!currentConversation) return;

    const confirmed = confirm(
        "Remove " + member + " from this room?"
    );

    if (!confirmed) return;

    try {
        const result = await apiRequest(
            "/api/rooms/" +
            encodeURIComponent(currentConversation.id) +
            "/members",
            "DELETE",
            {
                username: username,
                member: member
            }
        );

        currentConversation = result.room;

        updateConversationControls();
        await loadRooms();

    } catch (error) {
        console.error("Error removing room member:", error);
        alert(error.message);
    }
}

// =========================
// OPEN DIRECT MESSAGE
// =========================

async function openDirectMessage(friend) {
    try {
        const result = await apiRequest(
            "/api/direct-messages",
            "POST",
            {
                username: username,
                friend: friend
            }
        );

        await loadRooms();
        await selectConversation(result.conversation);

    } catch (error) {
        console.error("Error opening direct message:", error);
        alert(error.message);
    }
}

// =========================
// LOAD MESSAGES
// =========================

async function loadMessages() {
    if (!currentConversation) return;

    try {
        const messages = await apiRequest(
            "/api/messages?username=" +
            encodeURIComponent(username) +
            "&conversationId=" +
            encodeURIComponent(currentConversation.id)
        );

        chat.replaceChildren();

        messages.forEach(message => {
            chat.appendChild(createMessageElement(message));
        });

        chat.scrollTop = chat.scrollHeight;

    } catch (error) {
        console.error("Error loading messages:", error);
    }
}

// =========================
// CREATE MESSAGE ELEMENT
// =========================

function createMessageElement(message) {
    const messageElement = document.createElement("div");
    messageElement.className = "message";

    let avatarNumber = Number(
        String(message.pfp || "pfp0").replace("pfp", "")
    );

    if (!Number.isInteger(avatarNumber) ||
        avatarNumber < 0 ||
        avatarNumber > 23) {
        avatarNumber = 0;
    }

    const avatar = document.createElement("img");

    avatar.src = `/Assets/avatars/avatar${avatarNumber}.webp`;
    avatar.className = "message-pfp";
    avatar.alt = "Profile picture";

    const usernameElement = document.createElement("span");
    usernameElement.className = "username";
    usernameElement.textContent = message.username + ":";

    usernameElement.style.color =
        /^#[0-9a-fA-F]{6}$/.test(message.namecolor || "")
            ? message.namecolor
            : "#ffffff";

    const textElement = document.createElement("span");
    textElement.className = "message-text";
    textElement.textContent = message.message;

    messageElement.appendChild(avatar);
    messageElement.appendChild(usernameElement);
    messageElement.appendChild(textElement);

    return messageElement;
}

// =========================
// SEND MESSAGE
// =========================

async function send() {
    if (!currentConversation) return;

    const message = typing.value.trim();

    if (!message) return;

    if (message.startsWith("/")) {
        handleCommand(message);
        typing.value = "";
        return;
    }

    try {
        await apiRequest(
            "/api/messages",
            "POST",
            {
                username: username,
                conversationId: currentConversation.id,
                message: message
            }
        );

        typing.value = "";

    } catch (error) {
        console.error("Error sending message:", error);
        alert(error.message);
    }
}

// =========================
// ENTER TO SEND
// =========================

typing.addEventListener("keydown", function(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        send();
    }
});

// =========================
// FRIEND LIST
// =========================

async function friendsList() {
    try {
        const users = await apiRequest("/users.json");

        const currentUser = users.find(user =>
            user.username.toLowerCase() === username.toLowerCase()
        );

        const container = document.getElementById("friends");

        container.replaceChildren();

        if (!currentUser) return;

        allFriends = currentUser.friends || [];

        allFriends.forEach(friend => {
            const row = document.createElement("div");
            row.className = "friend-row";

            const name = document.createElement("span");
            name.textContent = friend;

            const messageButton = document.createElement("button");
            messageButton.textContent = "Message";

            messageButton.addEventListener("click", function() {
                openDirectMessage(friend);
            });

            row.appendChild(name);
            row.appendChild(messageButton);

            container.appendChild(row);
        });

    } catch (error) {
        console.error("Error loading friends:", error);
    }
}

// =========================
// SERVER-SENT EVENTS
// =========================

events.addEventListener("message", function(event) {
    const message = JSON.parse(event.data);

    if (!currentConversation ||
        message.conversationId !== currentConversation.id) {
        return;
    }

    chat.appendChild(createMessageElement(message));
    chat.scrollTop = chat.scrollHeight;
});

events.addEventListener("roomChanged", async function() {
    await loadRooms();
});

events.addEventListener("conversationCreated", async function() {
    await loadRooms();
});

events.addEventListener("friendAdded", async function() {
    await friendsList();
});

events.addEventListener("friendRemoved", async function() {
    await friendsList();
});

// =========================
// SLASH COMMANDS
// =========================

function handleCommand(message) {
    const parts = message.slice(1).trim().split(/\s+/);

    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {

        case "help":
            console.log(
                "Available commands: /help, /friend <username>, " +
                "/unfriend <username>, /customize, /logout"
            );
            break;

        case "friend": {
            const friend = args.join(" ").trim();

            if (!friend) {
                console.log("Usage: /friend <username>");
                break;
            }

            apiRequest("/friends", "POST", {
                username: username,
                friend: friend
            })
            .then(result => {
                console.log(result.message);
                friendsList();
            })
            .catch(error => console.error(error));

            break;
        }

        case "unfriend": {
            const friend = args.join(" ").trim();

            if (!friend) {
                console.log("Usage: /unfriend <username>");
                break;
            }

            apiRequest("/friends", "DELETE", {
                username: username,
                friend: friend
            })
            .then(result => {
                console.log(result.message);
                friendsList();
            })
            .catch(error => console.error(error));

            break;
        }

        case "customize":
            window.location.href = "customize.html";
            break;

        case "logout":
            document.cookie =
                "Username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";

            window.location.href = "index.html";
            break;

        default:
            console.log("Unknown command: " + command);
            break;
    }
}
