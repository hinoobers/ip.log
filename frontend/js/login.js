document.addEventListener('DOMContentLoaded', function() {
    const loginButton = document.getElementById("loginButton");
    loginButton.addEventListener("click", function() {
        const email = document.getElementById("emailInput").value;
        const password = document.getElementById("passwordInput").value;
        
        fetch("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        })
        .then(response => response.json())
        .then(data => {
            if(data.token) {
                alert("Login successful!");
                localStorage.setItem("token", data.token);
                window.location.href = "/dashboard.html";
            } else {
                alert("Login failed: " + (data.error || "Unknown error"));
            }
        })
        .catch(error => {
            console.error("Error during login:", error);
        });
    });
});