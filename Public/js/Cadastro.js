document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("cadastro-form");
  const mensagemErro = document.getElementById("mensagem-erro");
  const mensagemSucesso = document.getElementById("mensagem-sucesso");
  const modoRadios = document.getElementsByName("modo-congregacao");
  const camposCriar = document.getElementById("campos-criar-congregacao");
  const camposConvite = document.getElementById("campos-convite");

  function atualizarCamposModo() {
    const modoSelecionado = document.querySelector('input[name="modo-congregacao"]:checked').value;
    camposCriar.style.display = modoSelecionado === "criar" ? "block" : "none";
    camposConvite.style.display = modoSelecionado === "convite" ? "block" : "none";
  }

  modoRadios.forEach((radio) => radio.addEventListener("change", atualizarCamposModo));
  atualizarCamposModo();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const usuario = document.getElementById("usuario-nome").value;
    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;
    const confirmarSenha = document.getElementById("confirmarSenha").value;
    const modo = document.querySelector('input[name="modo-congregacao"]:checked').value;

    mensagemErro.textContent = "";
    mensagemSucesso.textContent = "";

    if (senha !== confirmarSenha) {
      mensagemErro.textContent = "As senhas não coincidem.";
      return;
    }

    if (senha.length < 6) {
      mensagemErro.textContent = "A senha deve ter pelo menos 6 caracteres.";
      return;
    }

    let congregacaoId;
    let nomeCongregacao;
    let codigoConviteNovo;
    let codigoConviteUsado;
    let codigoInformado;
    let isAdmin;
    let writtenPermission;

    // Validações que não dependem de leitura no Firestore rodam antes da
    // autenticação (que ainda não existe neste ponto).
    if (modo === "criar") {
      const nomeCongregacaoInput = document.getElementById("nome-congregacao").value;
      const numeroInput = document.getElementById("numero-congregacao").value;
      const numeroNormalizado = CongregacaoUtils.normalizarNumeroCongregacao(numeroInput);

      if (!nomeCongregacaoInput.trim()) {
        mensagemErro.textContent = "Informe o nome da congregação.";
        return;
      }
      if (!numeroNormalizado) {
        mensagemErro.textContent = "Número da congregação inválido. Use só dígitos (3 a 10 números).";
        return;
      }

      congregacaoId = numeroNormalizado;
      nomeCongregacao = nomeCongregacaoInput.trim();
      codigoConviteNovo = CongregacaoUtils.gerarCodigoConvite();
      isAdmin = true;
      writtenPermission = true;
    } else {
      codigoInformado = document.getElementById("codigo-convite").value.trim().toUpperCase();
      if (!codigoInformado) {
        mensagemErro.textContent = "Informe o código de convite.";
        return;
      }
    }

    // As regras de segurança do Firestore só permitem ler `congregacoes` (com
    // exigência de já pertencer a ela) e `convites` (com exigência de estar
    // autenticado) — um visitante novo não satisfaz nenhuma das duas antes de
    // ter uma conta. Por isso a conta de autenticação é criada primeiro, e a
    // checagem "essa congregação já existe" não usa mais uma leitura prévia:
    // ela é inferida da própria escrita, que o Firestore trata como "update"
    // (negado pela regra, pois o novo usuário ainda não é admin dela) quando
    // o documento já existe. Se qualquer etapa falhar depois que a conta de
    // auth foi criada, a conta é removida para permitir nova tentativa com o
    // mesmo email.
    let user;
    try {
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, senha);
      user = userCredential.user;

      if (modo === "criar") {
        try {
          await firebase.firestore().collection("congregacoes").doc(congregacaoId).set({
            nome: nomeCongregacao,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
            criadoPor: user.uid,
            codigoConvite: codigoConviteNovo,
          });
        } catch (congregacaoErr) {
          if (congregacaoErr.code === "permission-denied") {
            throw Object.assign(new Error("Essa congregação já existe."), {
              mensagemAmigavel: "Essa congregação já existe. Peça um convite ao admin dela.",
            });
          }
          throw congregacaoErr;
        }
        await firebase.firestore().collection("convites").doc(codigoConviteNovo).set({
          congregacaoId,
          ativo: true,
        });
      } else {
        const conviteDoc = await firebase.firestore().collection("convites").doc(codigoInformado).get();
        if (!conviteDoc.exists || conviteDoc.data().ativo === false) {
          throw Object.assign(new Error("Código de convite inválido."), {
            mensagemAmigavel: "Código de convite inválido.",
          });
        }
        congregacaoId = conviteDoc.data().congregacaoId;
        codigoConviteUsado = codigoInformado;
        isAdmin = false;
        writtenPermission = false;
      }

      const dadosUsuario = {
        usuario,
        email,
        congregacaoId,
        isAdmin,
        writtenPermission,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (modo === "convite") {
        // Exigido pela regra de criação de usuarios/{uid}: prova que este
        // usuário passou pelo fluxo de convite, não apenas adivinhou um
        // congregacaoId existente.
        dadosUsuario.codigoConvite = codigoConviteUsado;
      }
      await firebase.firestore().collection("usuarios").doc(user.uid).set(dadosUsuario);

      mensagemSucesso.textContent = "Usuário cadastrado com sucesso! Redirecionando...";
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1500);
    } catch (error) {
      console.error("Erro no cadastro:", error);

      // Se a conta de autenticação chegou a ser criada mas o cadastro não
      // foi concluído no Firestore, remove a conta órfã para o usuário poder
      // tentar de novo com o mesmo email.
      if (user) {
        try {
          await user.delete();
        } catch (cleanupErr) {
          console.error("Falha ao limpar conta órfã:", cleanupErr);
        }
      }

      let errorMessage = error.mensagemAmigavel || "Erro ao cadastrar usuário.";

      switch (error.code) {
        case "auth/email-already-in-use":
          errorMessage = "Este email já está em uso.";
          break;
        case "auth/invalid-email":
          errorMessage = "Email inválido.";
          break;
        case "auth/weak-password":
          errorMessage = "A senha deve ter pelo menos 6 caracteres.";
          break;
        case "permission-denied":
          errorMessage = "Não foi possível concluir o cadastro.";
          break;
      }

      mensagemErro.textContent = errorMessage;
    }
  });
});
