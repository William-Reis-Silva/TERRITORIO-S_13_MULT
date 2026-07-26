document.addEventListener("DOMContentLoaded", function () {
  var database = firebase.database();
  const startDate = new Date(2023, 8, 1); // Setembro 1, 2023
  const endDate = new Date(2024, 7, 31); // Agosto 31, 2024

  function analisarConclusoes(data, startDate, endDate) {
    const detalhesBairro = {};

    Object.keys(data).forEach((bairro) => {
      detalhesBairro[bairro] = {};
      const bairroData = data[bairro].Mapas;

      Object.keys(bairroData).forEach((mapaId) => {
        detalhesBairro[bairro][mapaId] = 0;
        const mapaInfo = bairroData[mapaId];

        if (mapaInfo.historico) {
          Object.values(mapaInfo.historico).forEach((hist) => {
            const dataInicio = hist.dataInicio
              ? new Date(hist.dataInicio)
              : null;
            const dataConclusao = hist.dataConclusao
              ? new Date(hist.dataConclusao)
              : null;

            if (
              dataInicio &&
              dataConclusao &&
              startDate <= dataInicio &&
              dataInicio <= endDate &&
              startDate <= dataConclusao &&
              dataConclusao <= endDate
            ) {
              detalhesBairro[bairro][mapaId] += 1;
            }
          });
        }
      });
    });

    return detalhesBairro;
  }

  function converterParaDataFrame(detalhesBairro) {
    const data = [];

    Object.keys(detalhesBairro).forEach((bairro) => {
      Object.keys(detalhesBairro[bairro]).forEach((mapaId) => {
        const conclusoes = detalhesBairro[bairro][mapaId];
        data.push({
          Bairro: bairro,
          "Mapa ID": mapaId,
          Conclusões: conclusoes,
        });
      });
    });

    return data;
  }

  function fetchMapData() {
    return database
      .ref("Bairros")
      .once("value")
      .then((snapshot) => snapshot.val());
  }

  fetchMapData()
    .then((data) => {
      const detalhesBairro = analisarConclusoes(data, startDate, endDate);
      const dfDetalhesBairro = converterParaDataFrame(detalhesBairro);

      // Exibir a tabela
      const tableContainer = document.getElementById("table-container");
      const table = document.createElement("table");
      const thead = document.createElement("thead");
      const tbody = document.createElement("tbody");

      // Add headers
      const headers = ["Bairro", "Mapa ID", "Conclusões"];
      const tr = document.createElement("tr");
      headers.forEach((header) => {
        const th = document.createElement("th");
        th.textContent = header;
        tr.appendChild(th);
      });
      thead.appendChild(tr);

      // Add rows
      dfDetalhesBairro.forEach((row) => {
        const tr = document.createElement("tr");
        headers.forEach((header) => {
          const td = document.createElement("td");
          td.textContent = row[header];
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });

      table.appendChild(thead);
      table.appendChild(tbody);
      tableContainer.appendChild(table);
    })
    .catch((error) => console.error("Error fetching data:", error));
});
