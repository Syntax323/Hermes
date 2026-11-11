
let username;

window.addEventListener("DOMContentLoaded", loadProfile);

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

async function loadProfile() {
    username = getCookie("Username");

    if (!username) {
        window.location.href = "index.html";
        return;
    }

    try {
        const profile = await apiRequest(
            "/api/profile?username=" + encodeURIComponent(username)
        );

        document.getElementById("theme").value = profile.theme;
        document.getElementById("pfp").value = profile.pfp;
        document.getElementById("namecolor").value =
            profile.namecolor;

    } catch (error) {
        console.error("Could not load profile:", error);

        document.getElementById("profile-status").textContent =
            error.message;
    }
}

async function save() {
    const theme = document.getElementById("theme").value;
    const pfp = document.getElementById("pfp").value;
    const namecolor = document.getElementById("namecolor").value;

    try {
        await apiRequest("/api/profile", "PUT", {
            username: username,
            theme: theme,
            pfp: pfp,
            namecolor: namecolor
        });

        window.location.href = "chat.html";

    } catch (error) {
        console.error("Could not save profile:", error);

        document.getElementById("profile-status").textContent =
            error.message;
    }
}
