var users;
var user;
var username;
var password;
var message;
var allmessages;
var messageId = 2;
var alias = Math.floor(Math.random() * 99)

// time variables
var year;
var month ;
var day;
var hour;
var minute;
var second;
const d = new Date();


// get time, probably inefficient asf
function msgtime(){
    year = d.getFullYear();
    month = d.getMonth();
    day = d.getDate();
    hour = d.getHours();
    minute = d.getMinutes();
    second = d.getSeconds();
    time = (year + "-" + month + "-" + day + "-" + hour + "-" + minute + "-" + second);
}

// send message, currently just to console
function send() {
    message = document.getElementById("typing").value;
    messageId += 1;
    msgtime();
    console.log(JSON.stringify({messageId, alias, message, time}, null, "\t"));
}

// get messages and display
fetch("/messages.json")
    .then(response => response.json())
    .then(messages => {

        const chat = document.getElementById("chat");

        messages.forEach(message => {

            const messageElement = document.createElement("p");

            messageElement.textContent =
                message.alias + ": " + message.message; //replace with message.username when cookie works

            chat.appendChild(messageElement);
        });

    })
    .catch(error => {
        console.error("Error loading messages:", error);
    });
