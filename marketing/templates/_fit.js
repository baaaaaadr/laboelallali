// Réduit la taille de police du contenu tant qu'il déborde du canevas.
// Inclus par chaque template ; expose window.__fitDone et window.__fitWarning.
window.__fitDone = false;
window.__fitWarning = null;
window.addEventListener("load", function () {
  var content = document.querySelector(".content");
  var floorPx = 26;
  if (content) {
    var size = parseFloat(getComputedStyle(content).fontSize);
    var guard = 40;
    while (guard-- > 0 && content.scrollHeight > content.clientHeight && size > floorPx) {
      size -= 2;
      content.style.fontSize = size + "px";
    }
    if (content.scrollHeight > content.clientHeight) {
      window.__fitWarning = "texte trop long malgré la réduction (plancher " + floorPx + "px)";
    }
  }
  window.__fitDone = true;
});
