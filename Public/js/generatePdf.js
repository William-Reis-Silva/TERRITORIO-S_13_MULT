document.getElementById("generatePdfBtn").addEventListener("click", function () {
  // Importa a biblioteca jsPDF e o plugin autoTable
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Extrai o ano de serviço
  const yearElement = document.getElementById("serviceYear");
  const serviceYearFullText = yearElement ? yearElement.textContent : "Ano desconhecido";

  const serviceYearMatch = serviceYearFullText.match(/(\d{4})/);
  const serviceYear = serviceYearMatch ? serviceYearMatch[0] : "Ano desconhecido";

  // Função para adicionar cabeçalho
  function addHeader(doc) {
    doc.setFontSize(14);
    doc.text("REGISTRO DE DESIGNAÇÃO DE TERRITÓRIO", 50, 15);
    doc.setFontSize(12);
    doc.text(`Ano de Serviço: ${serviceYear}`, 14, 25);
  }

  // Adiciona o cabeçalho na primeira página
  addHeader(doc);

  // Configurações do autoTable
  doc.autoTable({
    html: "#territoryTable",
    theme: "grid",
    startY: 30,
    headStyles: {
      fillColor: [220, 220, 220],
      textColor: [0, 0, 0],
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      halign: "center",
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    styles: {
      fontSize: 8,
      cellPadding: 1,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    // Adiciona cabeçalho em cada nova página
    didDrawPage: function (data) {
      // Se não é a primeira página, adiciona o cabeçalho
      if (data.pageNumber > 1) {
        addHeader(doc);
      }
    },
    // Ajusta o startY para páginas subsequentes
    showHead: "everyPage",
    margin: { top: 30 },
  });

  // Visualiza o PDF em uma nova janela antes de salvar
  window.open(doc.output("bloburl"), "_blank");

  // Salva o PDF
  doc.save("Registro S_13.pdf");
});
