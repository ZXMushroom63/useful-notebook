const ThreeDays = 1000 * 60 * 60 * 24 * 3;
if ((Date.now() - parseInt(localStorage.getItem("last-backup-date-pnb"))) > ThreeDays) {
    alert("You haven't backed up your notebook in 3 days!");
}