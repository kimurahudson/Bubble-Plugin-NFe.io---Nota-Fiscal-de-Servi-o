const ATUALIZACAO_MS = 5000;

const estado = {
  clienteSelecionadoId: null,
  ultimaBusca: "",
};

const elBusca = document.getElementById("busca");
const elListaClientes = document.getElementById("lista-clientes");
const elChatVazio = document.getElementById("chat-vazio");
const elChatConteudo = document.getElementById("chat-conteudo");
const elChatNome = document.getElementById("chat-nome");
const elChatDetalhes = document.getElementById("chat-detalhes");
const elChatMensagens = document.getElementById("chat-mensagens");

function formatarTelefone(telefone) {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length >= 12) {
    return `+${digitos.slice(0, 2)} (${digitos.slice(2, 4)}) ${digitos.slice(4, 9)}-${digitos.slice(9)}`;
  }
  return telefone;
}

function formatarDataHora(isoString) {
  const data = new Date(isoString.endsWith("Z") ? isoString : isoString + "Z");
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function carregarClientes() {
  const params = estado.ultimaBusca ? `?busca=${encodeURIComponent(estado.ultimaBusca)}` : "";
  const resposta = await fetch(`/clientes${params}`);
  const clientes = await resposta.json();
  renderizarListaClientes(clientes);
}

function renderizarListaClientes(clientes) {
  elListaClientes.innerHTML = "";

  if (clientes.length === 0) {
    elListaClientes.innerHTML = '<li class="lista-vazia">Nenhum cliente encontrado.</li>';
    return;
  }

  for (const cliente of clientes) {
    const li = document.createElement("li");
    li.dataset.id = cliente.id;
    if (cliente.id === estado.clienteSelecionadoId) {
      li.classList.add("ativo");
    }

    const infoLinha = [formatarTelefone(cliente.telefone), cliente.empresa]
      .filter(Boolean)
      .join(" · ");

    li.innerHTML = `
      <div class="cliente-nome">${escapeHtml(cliente.nome)}</div>
      <div class="cliente-info">${escapeHtml(infoLinha)}</div>
    `;
    li.addEventListener("click", () => selecionarCliente(cliente));
    elListaClientes.appendChild(li);
  }
}

async function selecionarCliente(cliente) {
  estado.clienteSelecionadoId = cliente.id;

  document.querySelectorAll(".lista-clientes li").forEach((li) => {
    li.classList.toggle("ativo", Number(li.dataset.id) === cliente.id);
  });

  elChatVazio.hidden = true;
  elChatConteudo.hidden = false;

  elChatNome.textContent = cliente.nome;
  const detalhes = [formatarTelefone(cliente.telefone), cliente.empresa]
    .filter(Boolean)
    .join(" · ");
  elChatDetalhes.textContent = detalhes;

  await carregarMensagens(cliente.id);
}

async function carregarMensagens(clienteId) {
  const resposta = await fetch(`/clientes/${clienteId}/mensagens`);
  if (!resposta.ok) return;
  const mensagens = await resposta.json();
  renderizarMensagens(mensagens);
}

function renderizarMensagens(mensagens) {
  const scrollNoFinal =
    elChatMensagens.scrollTop + elChatMensagens.clientHeight >= elChatMensagens.scrollHeight - 10;

  elChatMensagens.innerHTML = "";

  if (mensagens.length === 0) {
    elChatMensagens.innerHTML = '<div class="mensagens-vazio">Nenhuma mensagem ainda.</div>';
    return;
  }

  for (const mensagem of mensagens) {
    const div = document.createElement("div");
    div.className = `mensagem ${mensagem.direcao}`;
    div.innerHTML = `
      ${escapeHtml(mensagem.texto)}
      <span class="hora">${formatarDataHora(mensagem.timestamp)}</span>
    `;
    elChatMensagens.appendChild(div);
  }

  if (scrollNoFinal || mensagens.length <= 20) {
    elChatMensagens.scrollTop = elChatMensagens.scrollHeight;
  }
}

function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

let debounceBusca;
elBusca.addEventListener("input", () => {
  clearTimeout(debounceBusca);
  debounceBusca = setTimeout(() => {
    estado.ultimaBusca = elBusca.value.trim();
    carregarClientes();
  }, 250);
});

// Atualização periódica: lista de clientes e mensagens do cliente aberto,
// para novas mensagens do WhatsApp aparecerem sem precisar recarregar a página.
setInterval(() => {
  carregarClientes();
  if (estado.clienteSelecionadoId) {
    carregarMensagens(estado.clienteSelecionadoId);
  }
}, ATUALIZACAO_MS);

carregarClientes();
