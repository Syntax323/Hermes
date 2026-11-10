var users;
var user;
var username;
var password;
var message;
var allmessages;
var lastmsg;
var time;
var theme;
var pfp;
var nc;
const d = new Date();

// load past messages on page load
window.addEventListener("DOMContentLoaded", function() {
    getuser();
    loadmsgs();
    friendsList();
});

function getCookie(name) {
    let cookieArr = document.cookie.split(";");
    
    for(let i = 0; i < cookieArr.length; i++) {
        let cookiePair = cookieArr[i].split("=");

        if(name == cookiePair[0].trim()) {
            return decodeURIComponent(cookiePair.slice(1).join("="));
        }
    }
    return null;
}

// get username from cookie
function getuser() {
    username = getCookie("Username");
    theme = getCookie("Theme");
    pfp = getCookie("Pfp")
    nc = getCookie("Namecolor");
    if (username == null) {
        window.location.href = "index.html";
    }
    if (theme == null) {
        document.cookie = "Theme=theme0" + "; path=/";
    }
    if (pfp == null) {
        document.cookie = "Pfp=pfp0" + "; path=/";
    }
    if (nc == null) {
        document.cookie = "Namecolor=white" + "; path=/";
    }
    themelocation = document.getElementById("theme");
    themelocation.href = "themes/" + theme + ".css";
}

// get time
function msgtime() {
    const d = new Date();
    time = d.toISOString();
}

// send message on enter press
var typing = document.getElementById("typing");

typing.addEventListener("keydown", function (event) {
    if (event.code === "Enter" && !event.shiftKey) {
        event.preventDefault();
        send();
    }
});

// create a message element
function createMessageElement(message) {
    const messageElement = document.createElement("div");
    messageElement.className = "message";

    const usernameElement = document.createElement("span");
    usernameElement.className = "username";
    usernameElement.textContent = message.username + ":";

    const textElement = document.createElement("span");
    textElement.className = "message-text";
    textElement.textContent = message.message;

    messageElement.appendChild(usernameElement);
    messageElement.appendChild(textElement);

    let avatarNumber = Number(
        String(message.pfp || "pfp0").replace("pfp", "")
    );

    if (!Number.isInteger(avatarNumber) || avatarNumber < 0 || avatarNumber > 23) {
        avatarNumber = 0;
    }

    const pfp = document.createElement("img");

    pfp.src = `/Assets/avatars/avatar${avatarNumber}.webp`;
    pfp.className = "message-pfp";
    pfp.alt = "Profile picture";
    messageElement.appendChild(pfp);

    return messageElement;
}

// show username in typing box
getuser();
document.getElementById("typing").placeholder = "Typing as: " + username;

// send message
function send() {
    const input = document.getElementById("typing");
    message = input.value.trim();

    if (!message) return;

    if (message.startsWith("/")) {
        handleCommand(message);
        input.value = "";
        return;
    }

    msgtime();

    pfp: getCookie("Pfp") || "pfp0"

    const newMessage = {
        username: username,
        message: message,
        time: time,
        pfp: pfp
    };

    fetch("/messages.json", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(newMessage)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Failed to save message");
        }

        return response.json();
    })
    .then(() => {
        document.getElementById("typing").value = "";
        loadmsgs();
    })
    .catch(error => console.error("Error saving message:", error));
}

// get messages and display
function loadmsgs() {
    fetch("/messages.json")
    .then(response => response.json())
    .then(messages => {
        const chat = document.getElementById("chat");

        chat.replaceChildren();

        messages.forEach(message => {
            chat.appendChild(createMessageElement(message));
        });

        chat.scrollTop = chat.scrollHeight;
    })
    .catch(error => console.error("Error loading messages:", error));
}

// Show when new messages are sent
const events = new EventSource("/events");

events.onmessage = function(event) {
    const message = JSON.parse(event.data);

    const chat = document.getElementById("chat");
    chat.appendChild(createMessageElement(message));

    chat.scrollTop = chat.scrollHeight;
};

// Show when a friend is added
events.addEventListener("friendAdded", function(event) {
    const data = JSON.parse(event.data);

    if (data.username === username) {
        friendsList();
    }
});

events.addEventListener("friendRemoved", function(event) {
    const data = JSON.parse(event.data);

    if (data.username === username) {
        friendsList();
    }
});

// slash commands
function handleCommand(message) {
    const parts = message.slice(1).trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
        case "help":
            console.log("Available commands: /help, /friend <username>, /unfriend <username>, /customize, /logout");
            break;

        case "friend": {
            const friendUsername = args.join(" ").trim();

            if (!friendUsername) {
                console.log("Usage: /friend <username>");
                break;
            }

            fetch("/friends", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: username,
                    friend: friendUsername
                })
            })
            .then(async response => {
                const data = await response.json();

                console.log("Status:", response.status);
                console.log("Response:", data);

                if (!response.ok) {
                    throw new Error(data.message || "Request failed");
                }

                console.log(data.message);
            })
            .catch(error => {
                console.error("Error adding friend:", error);
            });

            break;
        }
    case "unfriend": {
        const friendUsername = args.join(" ").trim();

        if (!friendUsername) {
            console.log("Usage: /unfriend <username>");
            break;
        }

        fetch("/friends", {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: username,
                friend: friendUsername
            })
        })
        .then(async response => {
            const data = await response.json();

            console.log("Status:", response.status);
            console.log("Response:", data);

            if (!response.ok) {
                throw new Error(data.message || "Request failed");
            }

            console.log(data.message);
        })
        .catch(error => {
            console.error("Error removing friend:", error);
        });

        break;
    }
    case "customize": 
        window.location.href = "customize.html";
        break;
    
    case "logout":
        document.cookie = "Username=" + null + "; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
        window.location.href = "index.html";
        break;

        default:
            console.log("Unknown command: " + command);
            break;
    }
}

function friendsList() {
    fetch('/users.json')
    .then(response => response.json())
    .then(users => {
        const friends = document.getElementById("friends");

        friends.replaceChildren();

        // Find the currently logged-in user
        const currentUser = users.find(user =>
            user.username === username
        );

        if (!currentUser) {
            console.log("Current user not found");
            return;
        }

        // Get their friends, or an empty array
        const userFriends = currentUser.friends || [];

        // Display each friend
        userFriends.forEach(friend => {
            const friendElement = document.createElement("div");
            friendElement.textContent = friend;
            friends.appendChild(friendElement);
        });

        console.log("Friends:", userFriends);
    })
    .catch(error => console.error("Error loading JSON:", error));
}
