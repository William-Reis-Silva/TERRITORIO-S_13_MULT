firebase.auth().onAuthStateChanged(function (user) {
  const usuarioLogado = !!user;

  if (!usuarioLogado) {
    mensagemAcessoNegado.style.display = "none";

    links.forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        mensagemAcessoNegado.style.display = "block";
      });
    });
  } else {
    document.getElementById("user-greeting").style.display = "block";

    if (user.uid) {
      const userId = user.uid;
      const userDocRef = firebase.firestore().collection("usuarios").doc(userId);

      userDocRef
        .get()
        .then(function (doc) {
          if (doc.exists) {
            const userData = doc.data();

            // Exibe o nome do usuário
            document.getElementById("username").textContent = userData.usuario || "Usuário";

            // Exibe o botão Admin apenas se isAdmin for true
            if (userData.isAdmin === true) {
              document.getElementById("admin").style.display = "block";
            }
          } else {
            console.warn("Documento do usuário não encontrado");
            document.getElementById("username").textContent = "Usuário";
          }
        })
        .catch(function (error) {
          console.error("Erro ao recuperar os dados do usuário:", error);
        });
    }
  }
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const logoutLink = document.getElementById("logout");
logoutLink.addEventListener("click", function () {
  firebase
    .auth()
    .signOut()
    .then(function () {
      console.log("Usuário deslogado com sucesso.");
      window.location.href = "index.html";
    })
    .catch(function (error) {
      console.error("Erro ao fazer logout:", error);
    });
});
