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
      try {
        // Fetch a imagem e convertê-la em blob
        const response = await fetch(src);
        const blob = await response.blob();

        // Criar um objeto de arquivo
        const file = new File([blob], "imagem.jpg", { type: "image/jpeg" });

        // Verificar se o navegador suporta a Web Share API
        if (navigator.share) {
          await navigator.share({
            files: [file],
            title: "Compartilhar Imagem",
          });
        } else {
          // Fallback para o compartilhamento via WhatsApp com link
          let url = window.location.origin + "/" + src;
          window.open(
            `https://wa.me/?text=${encodeURIComponent(url)}`,
            "_blank"
          );
        }
      } catch (error) {
        console.error("Erro ao compartilhar:", error);
        // Fallback para o compartilhamento via WhatsApp com link
        let url = window.location.origin + "/" + src;
        window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, "_blank");
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
