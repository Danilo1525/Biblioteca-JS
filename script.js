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

    // Verificação de campos obrigatórios
    if (!numeroTombo || !quantidade || !tipoPessoa || !dataMaxima) {
        alert("⚠️ Por favor, preencha todos os campos obrigatórios.");
        return;
    }

    // Verificação específica para aluno e professor
    if (tipoPessoa === "aluno" && (!estudante || !serie)) {
        alert("⚠️ Para alunos, é necessário informar o nome e a série.");
        return;
    }
    if (tipoPessoa === "professor" && !prof) {
        alert("⚠️ Para professores, é necessário informar o nome.");
        return;
    }

    let tx = db.transaction(["livros", "emprestimos"], "readwrite");
    let store = tx.objectStore("livros");
    let emprestimosStore = tx.objectStore("emprestimos");
    let request = store.get(numeroTombo);

    request.onsuccess = function () {
        let livro = request.result;
        if (livro) {
            let emprestimo = {
                numeroTombo,
                titulo: livro.titulo,
                quantidade,
                estudante,
                prof,
                serie,
                turma,
                dataEmprestimo: new Date().toLocaleDateString(),
                dataMaxima,
                devolvido: false
            };
            emprestimosStore.add(emprestimo);
            alert(`📚 ${quantidade} unidade(s) do livro "${livro.titulo}" foram emprestadas para ${estudante || prof}!`);
            listarEmprestimos();
        } else {
            alert("Livro não encontrado.");
        }
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
    if (!tabela) {
        console.error("Elemento 'tabela-emprestimos' não encontrado!");
        return;
    }
    
    let tx = db.transaction("emprestimos", "readonly");
    let store = tx.objectStore("emprestimos");
    let request = store.openCursor();

    tabela.innerHTML = "";

    request.onsuccess = function (event) {
        let cursor = event.target.result;
        if (cursor) {
            let emprestimo = cursor.value;
            let row = document.createElement("tr");

            let hoje = new Date();
            let dataMaxima = new Date(emprestimo.dataMaxima);
            let classe = "";

            if (emprestimo.devolvido) {
                classe = "devolvido";
            } else if (hoje > dataMaxima) {
                classe = "atrasado";
            }

            row.className = classe;

            row.innerHTML = `
                <td>${emprestimo.devolvido ? '✔️ Devolvido' : (hoje > dataMaxima ? '❌ Atrasado' : '⏳ Em andamento')}</td>
                <td>${emprestimo.numeroTombo}</td>
                <td>${emprestimo.titulo} (QTD: ${emprestimo.quantidade})</td>
                <td>${emprestimo.estudante ? `Aluno: ${emprestimo.estudante}` : `Prof: ${emprestimo.prof}`} - Turma: ${emprestimo.turma} (${emprestimo.serie})</td>
                <td>${emprestimo.dataEmprestimo}</td>
                <td>${emprestimo.dataMaxima}</td>
                <td>
                    ${!emprestimo.devolvido ? `<button onclick="confirmarDevolucao(${emprestimo.id})">✔️ Confirmar</button>` : "Devolvido"}
                    <button onclick="apagarEmprestimo(${emprestimo.id})">❌ Apagar</button>
                </td>
            `;
            tabela.appendChild(row);
            cursor.continue();
        } else {
            console.log("Nenhum empréstimo encontrado.");
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

    fetch("livros.json")
        .then(response => response.json())
        .then(livros => {
            let listaLivros = document.getElementById("listaLivros");
            listaLivros.innerHTML = ""; // Limpa os resultados anteriores

            if (!Array.isArray(livros)) {
                listaLivros.innerHTML = "<p>Erro: Formato de dados inválido.</p>";
                return;
            }

            // 🔹 Ajuste para garantir que está acessando a propriedade correta do JSON
            let livrosEncontrados = livros.filter(livro => 
                livro.TITULO && livro.TITULO.toLowerCase().includes(tituloBuscado)
            );

            if (livrosEncontrados.length === 0) {
                listaLivros.innerHTML = "<p>Nenhum livro encontrado.</p>";
                return;
            }

            let total = livrosEncontrados.length;
            let ocupados = livrosEncontrados.filter(livro => livro.SITUAÇÃO === "Emprestado").length;
            let disponiveis = total - ocupados;

            let resultadoHTML = `
                <h2>Resultados para: "${tituloBuscado}"</h2>
                <p><strong>Total:</strong> ${total}</p>
                <hr>
                `;
                // <p><strong>Disponíveis:</strong> ${disponiveis}</p>
                // <p><strong>Ocupados:</strong> ${ocupados}</p>
                
            

            livrosEncontrados.forEach(livro => {
                resultadoHTML += `
                    <p>📖 <strong>${livro.TITULO}</strong> <br>
                    🔢 <strong>Tombo:</strong> ${livro.numeroTombo} <br>
                    <hr>
                    `;
                    // 📌 <strong>Status:</strong> ${livro.SITUAÇÃO}</p>
                    
                
            });

            listaLivros.innerHTML = resultadoHTML;
        })
        .catch(error => {
            console.error("Erro ao carregar os livros:", error);
            document.getElementById("listaLivros").innerHTML = "<p>Erro ao buscar livros.</p>";
        });
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