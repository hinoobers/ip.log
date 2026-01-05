document.addEventListener('DOMContentLoaded', function() {
    const registerButton = document.getElementById("registerButton");
    registerButton.addEventListener("click", function() {
        const email = document.getElementById("emailInput").value;
        const password = document.getElementById("passwordInput").value;
        
        fetch("/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        })
        .then(response => response.json())
        .then(data => {
            if(data.error) {
                alert("Registration failed: " + data.error);
            } else {
                alert("Registration successful! You may now login.");
            }
        })
        .catch(error => {
            console.error("Error during registration:", error);
        });
    });
});