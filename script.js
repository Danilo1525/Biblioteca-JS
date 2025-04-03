// Criar ou abrir o banco de dados IndexedDB
let db;
const request = indexedDB.open("bibliotecaDB", 1);

request.onupgradeneeded = function (event) {
    db = event.target.result;
    let store = db.createObjectStore("livros", { keyPath: "numeroTombo" });
    store.createIndex("titulo", "TITULO", { unique: false });

    let emprestimosStore = db.createObjectStore("emprestimos", { keyPath: "id", autoIncrement: true });
    emprestimosStore.createIndex("numeroTombo", "numeroTombo", { unique: false });

    console.log("Banco de dados atualizado!");
};

request.onsuccess = function (event) {
    db = event.target.result;

    // Verifica se já existem livros no IndexedDB antes de carregar o JSON
    let tx = db.transaction("livros", "readonly");
    let store = tx.objectStore("livros");
    let countRequest = store.count();

    countRequest.onsuccess = function () {
        if (countRequest.result === 0) {
            console.log("Nenhum livro encontrado no banco. Carregando do JSON...");
            carregarLivrosDoJSON();
        } else {
            console.log("Livros já carregados no IndexedDB.");
        }
    };

    listarEmprestimos();
};

request.onerror = function () {
    console.error("Erro ao abrir o banco de dados.");
};

// 📌 Função para carregar os livros do JSON e salvar no IndexedDB
function carregarLivrosDoJSON() {
    fetch("livros.json")
        .then(response => response.json())
        .then(data => {
            let tx = db.transaction("livros", "readwrite");
            let store = tx.objectStore("livros");

            data.forEach(livro => {
                let livroObj = {
                    numeroTombo: String(livro.numeroTombo), // 🔹 Sempre salvar como string
                    titulo: livro.TITULO,
                    autor: livro.AUTOR,
                    editora: livro.EDITORA,
                    genero: livro["GÊNERO"],
                    dataTombo: livro["DATA TOMBO"],
                    origem: livro.ORIGEM,
                    situacao: livro.SITUAÇÃO
                };

                store.add(livroObj)
                    .onsuccess = () => console.log(`📖 Livro adicionado:`, livroObj);
            });

            console.log("📚 Livros carregados no IndexedDB!");
        })
        .catch(error => console.error("Erro ao carregar livros.json:", error));
}

// 📌 Função para registrar empréstimo com data máxima de devolução
function emprestarLivro() {
    let numeroTombo = document.getElementById("tombo_emprestimo").value.trim();
    let quantidade = document.getElementById("quantidade_emprestimo").value.trim();
    let tipoPessoa = document.getElementById("tipo_pessoa").value;
    let estudante = document.getElementById("nome_estudante").value.trim();
    let prof = document.getElementById("nome_professor").value.trim();
    let serie = document.getElementById("serie_estudante").value;
    let turma = document.getElementById("turma").value;
    let dataMaxima = document.getElementById("data_devolucao").value;

    // Validações básicas
    if (!numeroTombo || !quantidade || !tipoPessoa || !dataMaxima) {
        alert("⚠️ Por favor, preencha todos os campos obrigatórios.");
        return;
    }

    // Validações específicas
    if (tipoPessoa === "aluno" && (!estudante || !serie)) {
        alert("⚠️ Para alunos, é necessário informar o nome e a série.");
        return;
    }
    if (tipoPessoa === "professor" && !prof) {
        alert("⚠️ Para professores, é necessário informar o nome.");
        return;
    }

    let tx = db.transaction(["livros", "emprestimos"], "readwrite");
    let livrosStore = tx.objectStore("livros");
    let emprestimosStore = tx.objectStore("emprestimos");

    // Verifica se o livro já está emprestado
    let emprestimoIndex = emprestimosStore.index("numeroTombo");
    emprestimoIndex.getAll(numeroTombo).onsuccess = function(e) {
        let emprestimosAtivos = e.target.result.filter(emp => !emp.devolvido);
        
        if (emprestimosAtivos.length > 0) {
            alert("⚠️ Este livro já está emprestado!");
            return;
        }

        // Se não estiver emprestado, prossegue
        livrosStore.get(numeroTombo).onsuccess = function(e) {
            let livro = e.target.result;
            if (!livro) {
                alert("Livro não encontrado.");
                return;
            }

            let emprestimo = {
                numeroTombo: numeroTombo,
                titulo: livro.titulo,
                quantidade: quantidade,
                estudante: estudante,
                prof: prof,
                serie: serie,
                turma: turma,
                dataEmprestimo: new Date().toLocaleDateString(),
                dataMaxima: dataMaxima,
                devolvido: false
            };

            emprestimosStore.add(emprestimo).onsuccess = function() {
                alert(`📚 Livro "${livro.titulo}" emprestado com sucesso para ${estudante || prof}!`);
                listarEmprestimos();
            };
        };
    };
}
// 📌 Função para buscar livro
function buscarLivro() {
    let numeroTombo = document.getElementById("buscar_tombo").value.trim();

    console.log(`🔍 Buscando livro pelo tombo: ${numeroTombo}`);

    let tx = db.transaction("livros", "readonly");
    let store = tx.objectStore("livros");

    let request = store.get(String(numeroTombo)); // 🔹 Buscar como string

    request.onsuccess = function () {
        let livro = request.result;
        if (livro) {
            console.log("✅ Livro encontrado:", livro);
            document.getElementById("livro-info").innerText = 
                `📖 ${livro.titulo} - ${livro.autor} (Editora: ${livro.editora}, Gênero: ${livro.genero})`;
        } else {
            console.log("❌ Livro não encontrado no IndexedDB.");
            document.getElementById("livro-info").innerText = "Livro não encontrado.";
        }
    };

    request.onerror = function () {
        console.error("Erro ao buscar livro no IndexedDB.");
    };
}



// 📌 Função para exibir as informações do livro
function mostrarLivro(livro) {
    document.getElementById("livro-info").innerText = 
        `📖 ${livro.titulo} - ${livro.autor} (Editora: ${livro.editora}, Gênero: ${livro.genero})`;
}

// 📌 Função para confirmar devolução sem remover o registro
function confirmarDevolucao(id) {
    let tx = db.transaction("emprestimos", "readwrite");
    let store = tx.objectStore("emprestimos");

    let request = store.get(id);
    request.onsuccess = function () {
        let emprestimo = request.result;
        if (emprestimo) {
            emprestimo.devolvido = true;
            store.put(emprestimo).onsuccess = function () {
                alert("Livro devolvido com sucesso!");
                listarEmprestimos();
            };
        } else {
            alert("Empréstimo não encontrado.");
        }
    };
}

// 📌 Função para listar livros emprestados com cores para status
function listarEmprestimos() {
    let tabela = document.getElementById("tabela-emprestimos");
    if (!tabela) return;
    
    tabela.innerHTML = ""; // Limpa a tabela

    let tx = db.transaction("emprestimos", "readonly");
    let store = tx.objectStore("emprestimos");
    let request = store.openCursor();

    request.onsuccess = function(event) {
        let cursor = event.target.result;
        if (cursor) {
            let emprestimo = cursor.value;
            let row = document.createElement("tr");

            // Verifica status
            let hoje = new Date();
            let dataMaxima = new Date(emprestimo.dataMaxima);
            let status;
            
            if (emprestimo.devolvido) {
                status = '✔️ Devolvido';
                row.classList.add("devolvido");
            } else if (hoje > dataMaxima) {
                status = '❌ Atrasado';
                row.classList.add("atrasado");
            } else {
                status = '⏳ Em andamento';
            }

            // Corrige valores undefined
            let destinatario = emprestimo.estudante || emprestimo.prof || "N/A";
            let turmaSerie = emprestimo.turma ? `Turma: ${emprestimo.turma}` : "";
            turmaSerie += emprestimo.serie ? ` (${emprestimo.serie})` : "";

            row.innerHTML = `
                <td>${status}</td>
                <td>${emprestimo.numeroTombo || "N/A"}</td>
                <td>${emprestimo.titulo || "Sem título"} (QTD: ${emprestimo.quantidade || 1})</td>
                <td>${destinatario} ${turmaSerie}</td>
                <td>${emprestimo.dataEmprestimo || "N/A"}</td>
                <td>${emprestimo.dataMaxima || "N/A"}</td>
                <td>
                    ${!emprestimo.devolvido ? 
                        `<button onclick="confirmarDevolucao(${emprestimo.id})">✔️ Confirmar</button>` : 
                        "Devolvido"}
                    <button onclick="apagarEmprestimo(${emprestimo.id})">❌ Apagar</button>
                </td>
            `;
            
            tabela.appendChild(row);
            cursor.continue();
        }
    };
}
function apagarEmprestimo(id) {
    let tx = db.transaction("emprestimos", "readwrite");
    let store = tx.objectStore("emprestimos");

    store.delete(id).onsuccess = function () {
        alert("Empréstimo removido com sucesso!");
        listarEmprestimos();
    };
}
function buscarlivro() {
    let tituloBuscado = document.getElementById("buscarLivro").value.trim().toLowerCase();
    let listaLivros = document.getElementById("listaLivros");
    listaLivros.innerHTML = "";

    // Busca simultânea nos livros e empréstimos
    Promise.all([
        fetch("livros.json").then(response => response.json()),
        new Promise((resolve) => {
            let tx = db.transaction("emprestimos", "readonly");
            let store = tx.objectStore("emprestimos");
            let request = store.getAll();
            request.onsuccess = () => resolve(request.result);
        })
    ]).then(([livros, emprestimos]) => {
        if (!Array.isArray(livros)) {
            listaLivros.innerHTML = "<p>Erro: Formato de dados inválido.</p>";
            return;
        }

        // Filtra livros pelo título
        let livrosEncontrados = livros.filter(livro => 
            livro.TITULO && livro.TITULO.toLowerCase().includes(tituloBuscado)
        );

        if (livrosEncontrados.length === 0) {
            listaLivros.innerHTML = "<p>Nenhum livro encontrado.</p>";
            return;
        }

        // Filtra empréstimos ativos (não devolvidos)
        let emprestimosAtivos = emprestimos.filter(e => !e.devolvido);

        // Calcula disponibilidade
        let total = livrosEncontrados.length;
        let ocupados = livrosEncontrados.filter(livro => 
            emprestimosAtivos.some(e => e.numeroTombo === String(livro.numeroTombo))
        ).length;
        let disponiveis = total - ocupados;

        // Monta o HTML
        let resultadoHTML = `
            <h2>Resultados para: "${tituloBuscado}"</h2>
            <p><strong>Total:</strong> ${total}</p>
            <p><strong>Disponíveis:</strong> ${disponiveis}</p>
            <p><strong>Emprestados:</strong> ${ocupados}</p>
            <hr>
        `;

        // Adiciona cada livro com seu status
        livrosEncontrados.forEach(livro => {
            let emprestimoAtivo = emprestimosAtivos.find(e => e.numeroTombo === String(livro.numeroTombo));
            let status = emprestimoAtivo ? '❌ Emprestado' : '✅ Disponível';
            let destinatario = emprestimoAtivo ? 
                (emprestimoAtivo.estudante || emprestimoAtivo.prof || "N/A") : "";

            resultadoHTML += `
                <div class="livro-item">
                    <p>📖 <strong>${livro.TITULO}</strong></p>
                    <p>🔢 <strong>Tombo:</strong> ${livro.numeroTombo}</p>
                    <p>📌 <strong>Status:</strong> ${status}</p>
                    ${emprestimoAtivo ? `<p>👤 <em>Emprestado para: ${destinatario}</em></p>` : ''}
                    <hr>
                </div>
            `;
        });

        listaLivros.innerHTML = resultadoHTML;
    }).catch(error => {
        console.error("Erro:", error);
        listaLivros.innerHTML = "<p>Erro ao buscar livros.</p>";
    });
}
// Função auxiliar para pegar o nome de quem pegou o livro emprestado
function getNomeEmprestimo(numeroTombo, emprestimosAtivos) {
    let emprestimo = emprestimosAtivos.find(e => e.numeroTombo === String(numeroTombo));
    return emprestimo ? (emprestimo.estudante || emprestimo.prof) : "N/A";
}

// Adicione este código junto com o resto do seu JavaScript
document.getElementById('clearDB').addEventListener('click', function() {
    if (confirm("⚠️ ATENÇÃO! Tem certeza que deseja APAGAR TODOS OS DADOS e forçar uma atualização?")) {
        // Usando o mesmo nome do banco de dados que você definiu no open()
        let dbName = "bibliotecaDB";
        
        // Fecha qualquer conexão existente primeiro
        if (db) {
            db.close();
        }
        
        // Deleta o banco de dados
        let req = indexedDB.deleteDatabase(dbName);
        
        req.onsuccess = function() {
            console.log("Banco de dados apagado com sucesso!");
            alert("Banco de dados apagado com sucesso! A página será recarregada.");
            localStorage.setItem('forceReload', 'true');
            location.reload();
        };
        
        req.onerror = function() {
            console.error("Falha ao apagar o banco de dados");
            alert("Erro ao apagar o banco de dados. Tente novamente.");
        };
        
        req.onblocked = function() {
            alert("O banco de dados está bloqueado por outra aba. Feche outras abas do sistema e tente novamente.");
        };
    }
});


// 📌 CSS para status de empréstimo
const style = document.createElement('style');
style.innerHTML = `
    .atrasado { background-color: #f8d7da; } /* Vermelho para atrasados */
    .devolvido { background-color: #d4edda; } /* Verde para devolvidos */
`;
document.head.appendChild(style);