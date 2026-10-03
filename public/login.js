var users;
var user;
var username;
var password;
var i = 1;

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
        setCookie(); 
    } else {
        console.log("login failed");
        toggleText();
    };
};

// show wrong user/pass text
function toggleText() {
    const textElement = document.getElementById("page1");
    console.log(i);
        while(i == 1) {
            if (textElement.style.display === "none") {
                textElement.style.display = "block";
                i = 2;
                console.log(i);
            } else {
                textElement.style.display = "none";
                console.log(i);
            }
        }
};