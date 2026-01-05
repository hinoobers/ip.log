function getJwtTtlSeconds(token) {
    const payloadBase64 = token.split(".")[1];
    const payloadJson = atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);

    if (!payload.exp) return null;

    const now = Math.floor(Date.now() / 1000);
    return payload.exp - now;
}


document.addEventListener('DOMContentLoaded', function() {
    if(localStorage.getItem("token") === null && window.location.href.endsWith("dashboard.html")) {
        // Tagasi login lehele kui pole tokenit, mitte et see kuidagi neid aitaks aga jh
        window.location.href = "/login.html";
        return;
    };

    if(localStorage.getItem("token") !== null) {
        const expiry = getJwtTtlSeconds(localStorage.getItem("token"));
        if(expiry <= 0) {
            localStorage.removeItem("token");
        } else {
            // Turn login to dashboard/main page
            const login = document.querySelector("nav a[href=\"/login.html\"]");
            if(login) {
                if(window.location.href.endsWith("dashboard.html")) {
                    login.href = "/index.html";
                    login.innerText = "Home";
                } else {
                    login.href = "/dashboard.html";
                    login.innerText = "Dashboard";
                }
            }

            // turn register to log out
            const register = document.querySelector("nav a[href=\"/register.html\"]");
            if(register) {
                register.href = "#";
                register.innerText = "Log out";
                register.addEventListener("click", function() {
                    localStorage.removeItem("token");
                    window.location.href = "/login.html";
                });
            }
        }
    }
});