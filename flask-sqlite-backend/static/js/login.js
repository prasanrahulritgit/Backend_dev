    document.addEventListener('DOMContentLoaded', function() {
        lucide.createIcons(); // render icons on page load
 
        const alerts = document.querySelectorAll('.alert');
        const togglePassword = document.querySelector("#togglePassword");
        const passwordInput = document.querySelector(".password-input");
        const icon = togglePassword.querySelector("i");
 
        if (togglePassword && passwordInput) {
            togglePassword.addEventListener("mousedown", () => {
                passwordInput.setAttribute("type", "text");
                icon.setAttribute("data-lucide", "eye-off");
                lucide.createIcons();
            });
 
            togglePassword.addEventListener("mouseup", () => {
                passwordInput.setAttribute("type", "password");
                icon.setAttribute("data-lucide", "eye");
                lucide.createIcons();
            });
 
            togglePassword.addEventListener("mouseleave", () => {
                passwordInput.setAttribute("type", "password");
                icon.setAttribute("data-lucide", "eye");
                lucide.createIcons();
            });
        }
 
        alerts.forEach(alert => {
            setTimeout(() => {
                alert.style.opacity = '0';
                setTimeout(() => alert.remove(), 300);
            }, 5000);
        });
    });
