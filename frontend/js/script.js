document.addEventListener('DOMContentLoaded', function() {
    const lookup = document.getElementById("checkIpButton");
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
});