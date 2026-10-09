var users;
var user;
var username;
var password;
var message;
var allmessages;
var lastmsg;
var alias = Math.floor(Math.random() * 99)
const d = new Date();

// load past messages on page load
window.onload = loadmsgs;

// get time
function msgtime() {
    const d = new Date();
    time = d.toISOString();
}

// send message on enter press
var typing = document.getElementById("typing");
typing.addEventListener("keydown", function (event){
if (event.code === "Enter") {
    send();
  }
});

// send message
function send() {
    message = document.getElementById("typing").value.trim();

    if (!message) return;
    msgtime();

    const newMessage = {
        alias: alias,
        message: message,
        time: time
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
function loadmsgs(){
    fetch("/messages.json")
    .then(response => response.json())
    .then(messages => {
        const chat = document.getElementById("chat");

        chat.replaceChildren();

        messages.forEach(message => {
            const messageElement = document.createElement("p");

            messageElement.textContent =
                message.alias + ": " + message.message;

            chat.appendChild(messageElement);
        });
    })
    .catch(error => console.error("Error loading messages:", error));
    }

// show when new messages are sent
const events = new EventSource("/events");

events.onmessage = function(event) {
    const message = JSON.parse(event.data);

    const chat = document.getElementById("chat");
    const messageElement = document.createElement("p");

    messageElement.textContent =
        message.alias + ": " + message.message;

    chat.appendChild(messageElement);
};