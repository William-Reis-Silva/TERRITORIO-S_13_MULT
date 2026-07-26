function openFullscreen(src) {
  let fullscreenDiv = document.getElementById("fullscreen");
  let img = document.getElementById("fullscreen-img");

  img.src = src;
  fullscreenDiv.style.display = "flex";
  fullscreenDiv.style.flexDirection = "column";
  fullscreenDiv.style.alignItems = "center";
  fullscreenDiv.style.justifyContent = "center";

  let botao = document.getElementById("botaoCompartilhar");
  if (!botao) {
    botao = document.createElement("button");
    botao.id = "botaoCompartilhar";
    botao.innerText = "Compartilhar";
    botao.style.marginTop = "15px";
    botao.style.padding = "10px 20px";
    botao.style.background = "#25D366";
    botao.style.color = "#fff";
    botao.style.border = "none";
    botao.style.borderRadius = "5px";
    botao.style.cursor = "pointer";
    botao.style.fontSize = "16px";

    botao.onclick = async () => {
      const url = /^https?:\/\//i.test(src) ? src : window.location.origin + "/" + src;
      const compartilharLink = () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, "_blank");
      };

      try {
        // Fetch a imagem e convertê-la em blob
        const response = await fetch(src);
        if (!response.ok) throw new Error(`Falha ao baixar imagem (HTTP ${response.status})`);
        const blob = await response.blob();

        // Criar um objeto de arquivo
        const file = new File([blob], "imagem.jpg", { type: blob.type || "image/jpeg" });

        // Só tenta compartilhar arquivo se o navegador realmente suportar esse arquivo
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Compartilhar Imagem",
          });
        } else {
          console.warn("Compartilhamento de arquivo não suportado neste navegador, enviando apenas o link.");
          compartilharLink();
        }
      } catch (error) {
        console.error("Erro ao compartilhar imagem (provável bloqueio de CORS no Storage ou share cancelado):", error);
        // Fallback para o compartilhamento via WhatsApp com link
        compartilharLink();
      }
    };

    fullscreenDiv.appendChild(botao);
  } else {
    botao.style.display = "block";
  }
}

function closeFullscreen() {
  document.getElementById("fullscreen").style.display = "none";
  let botao = document.getElementById("botaoCompartilhar");
  if (botao) botao.style.display = "none";
}
