async function loadLayout() {
  const header = await fetch("pages/header.html").then(res => res.text());
  const navbar = await fetch("pages/navbar.html").then(res => res.text());

  document.getElementById("header").innerHTML = header;
  document.getElementById("navbar").innerHTML = navbar;
}

loadLayout();

// clock
setInterval(() => {
  const now = new Date();
  const time = now.toLocaleTimeString();
  const clock = document.getElementById("clock");
  if (clock) clock.innerText = time;
}, 1000);
