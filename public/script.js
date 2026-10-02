var users;
var user;
var username;
var password;
var message;
var allmessages;


fetch('/users.json')
    .then(response => response.json())
    .then(data => {
        users = data.users;
        console.log(data);
        console.log(users);
    })
    .catch(error => console.error('Error loading JSON:', error));


function login() {

    username = document.getElementById("username").value;
    password = document.getElementById("password").value;

    user = users.find(function(user) {
        return user.username == username && 
               user.password == password;
    });

    if (user) {
        console.log("login success");
        window.location.href = "chat.html";
        // document.getElementById("loggedinas").innerHTML="LOGGED IN AS " + username;
    } else {
        console.log("login failed");
    };
};


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


//go from login to messages page
function showPage(pageId) {
    if (user) {
        document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
    };
};