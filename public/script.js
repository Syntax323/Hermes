var users;
var user;
var username;
var password;
var message;
var allmessages;





function send() {
    message = document.getElementById("typing").value;
    console.log(message);
}


fetch("/messages.json")
    .then(response => response.json())
    .then(messages => {

        const chat = document.getElementById("chat");

        messages.forEach(message => {

            const messageElement = document.createElement("p");

            messageElement.textContent =
                message.username + ": " + message.message;

            chat.appendChild(messageElement);
        });

    })
    .catch(error => {
        console.error("Error loading messages:", error);
    });