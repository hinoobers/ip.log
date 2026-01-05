document.addEventListener('DOMContentLoaded', function() {
    const lookup = document.getElementById("checkIpButton");
    const createApiKeyButton = document.getElementById("createApiKeyButton");
    
    if(createApiKeyButton) {
        createApiKeyButton.addEventListener("click", function() {
            fetch("/createApiKey", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + localStorage.getItem("token")
                }
            })
            .then(response => response.json())
            .then(data => {
                if(data.error) {
                    alert("API Key creation failed: " + data.error);
                } else {
                    alert("API Key created successfully: " + data.apiKey);
                    document.getElementById("apiKeyHeader").style.display = "block";
                    document.getElementById("apiKeyHeader").innerText = "Your API Key: " + data.apiKey;
                }
            })
            .catch(error => {
                console.error("Error creating API Key:", error);
            });
        });
    };

    if(lookup) {
        lookup.addEventListener("click", function() {
            const input = document.getElementById("ipInput").value;
            fetch(`/checkip?ip=${encodeURIComponent(input)}`)
                .then(response => response.json())
                .then(data => {
                    const resultArea = document.getElementById("resultArea");
                    resultArea.value = JSON.stringify(data, null, 2);
                    document.querySelector(".result-group").style.display = "block";
                })
                .catch(error => {
                    console.error("Error fetching IP data:", error);
                });
        });
    }
});