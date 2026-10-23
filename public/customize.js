var value;
var theme;
var pfp;
var namecolor;

function save() {
    theme = document.getElementById("theme");
    value = theme.value;
    document.cookie = "Theme=" + encodeURIComponent(value) + "; path=/";

    pfp = document.getElementById("pfp")
    value = pfp.value;
    document.cookie = "Pfp=" + encodeURIComponent(value) + "; path=/";
    
    namecolor = document.getElementById("namecolor")
    value = pfp.value;
    document.cookie = "Namecolor=" + encodeURIComponent(value) + "; path=/";
    location.href="chat.html";
}
