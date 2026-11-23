# Modelo PLIM para planejamento da moagem e do estoque de açúcar mascavo

Este repositório contém o código e a planilha do Trabalho de Conclusão de Curso **"Otimização da Produção e do Estoque de Açúcar Mascavo diante da Sazonalidade da Cana-de-Açúcar"**:

- **Autor:** Wesley Vieira Martins de Andrade
- **Orientação:** Profa. Dra. Alessandra Martins Coelho
- **Instituição:** Bacharelado em Ciência da Computação, IF Sudeste MG, campus Rio Pomba, 2026

O modelo de Programação Linear Inteira Mista (PLIM) decide quantos dias moer em cada mês da safra e de quais lotes vender o açúcar em cada mês. O objetivo é minimizar a ruptura de estoque (demanda não atendida) ao longo de 12 meses. O modelo considera os dias perdidos por chuva, a variação mensal do ATR, a cana disponível e o prazo de validade do açúcar. Ele é resolvido dentro do Google Planilhas pelo serviço de otimização do Google Apps Script (`LinearOptimizationService`), sem instalar nenhum programa.

## Conteúdo

| Arquivo | Descrição |
|---|---|
| `Codigo.gs` | Código do modelo em Google Apps Script |
| `modelo_solver.xlsx` | Cópia da planilha usada no trabalho, com a aba **Modelo** |

## Requisitos

- Uma conta Google (Gmail).
- Navegador com acesso ao Google Drive.

## Como reproduzir

### 1. Abrir a planilha no Google Planilhas
1. Envie `modelo_solver.xlsx` para o seu Google Drive.
2. Abra o arquivo com o **Google Planilhas**.
3. Use **Arquivo → Salvar como Planilhas Google**.

A aba com os dados precisa se chamar **Modelo**, porque o script procura a aba por esse nome.

### 2. Inserir o código
1. Na planilha, abra **Extensões → Apps Script**.
2. Apague o conteúdo do arquivo `Código.gs` que aparece no editor.
3. Cole todo o conteúdo de `Codigo.gs` deste repositório.
4. Clique em **Salvar** (ícone de disquete).

### 3. Recarregar a planilha
Feche a aba do Apps Script e recarregue a planilha (F5). Na barra de menus deve aparecer o menu **Otimização**.

### 4. Resolver o modelo
1. Clique em **Otimização → Resolver modelo**.
2. Na primeira execução, o Google pede autorização para o script acessar a planilha. Clique em **Continuar** e escolha a sua conta.
3. Se aparecer o aviso de que o app não foi verificado pelo Google, clique em **Avançado** e depois em **Acessar Modelo (não seguro)**. O aviso aparece porque o script é pessoal e não foi publicado.
4. Clique em **Permitir** e execute **Otimização → Resolver modelo** novamente.

A resolução leva poucos segundos. Ao final, aparece um aviso no canto inferior da tela, e o status fica registrado na célula **C67**.

### 5. Ler o resultado
O script escreve a solução nas células verdes:
- **Linha 25 (C25:N25):** dias de moagem de cada mês ($d_t$)
- **C35:N43:** quanto do açúcar de cada lote é vendido em cada mês ($x_{s,t}$)

As fórmulas da planilha calculam, a partir da solução, a produção, as vendas, a ruptura, o açúcar que vence e o estoque de cada mês. O bloco de conferência mostra:
- as vendas fora da validade, que devem ser 0;
- a cana moída e a cana disponível;
- a ruptura total $Z$.

## Estrutura da aba Modelo

| Célula ou linha | Conteúdo | Uso |
|---|---|---|
| C4 | Rendimento médio (kg de açúcar por t de cana) | Entrada |
| C5 | $\varphi$, fator de conversão do ATR (calculado) | Lido pelo script |
| C6 | $q$, cana moída por dia (t/dia) | Entrada, lido pelo script |
| C7 | $V$, prazo de validade (meses) | Entrada, lido pelo script |
| C8 | $E_0$, estoque inicial em abril (kg) | Entrada, lido pelo script |
| C9 | $C$, cana disponível na safra (t) | Entrada, lido pelo script |
| C10 | $\theta$, fração dos dias úteis perdida por chuva | Entrada |
| C11 | Distribuição da chuva (1 = uniforme, 2 = concentrada) | Entrada |
| C12 | Fator do ATR | Entrada |
| C13 | $D$, demanda mensal (kg) | Entrada |
| Linha 19 | ATR base (Socicana, safra 2025/26) | Entrada |
| Linha 20 | ATR usado = ATR base × (1 + fator) | Lido pelo script |
| Linha 21 | $U_t$, dias úteis | Entrada |
| Linha 23 | $L_t$, dias perdidos por chuva (calculados a partir de $\theta$) | Fórmula |
| Linha 24 | Dias disponíveis = $U_t - L_t$ | Lido pelo script |
| Linha 25 | $d_t$, dias de moagem | **Saída do script** |
| Linha 28 | $D_t$, demanda | Lido pelo script |
| C35:N43 | $x_{s,t}$, vendas por lote | **Saída do script** |
| C67 | Status do otimizador | **Saída do script** |

As células em amarelo são as entradas que podem ser alteradas.

## Como o modelo é implementado no código

**Variáveis do otimizador**
- $d_t$: inteira, entre 0 e os dias disponíveis do mês. Corresponde às restrições (6) e (7).
- $R_t$: contínua e não negativa.
- $x_{s,t}$: contínua e não negativa, criada apenas para os pares de lote e mês permitidos pela validade, ou seja, quando o mês de venda vai de $s$ até $\tau_s = s + V$, com $\tau_0 = V - 4$ para o estoque inicial. Como não há produção de dezembro a março, são criados apenas os lotes 0 a 8.

**Restrições**
- **Demanda (9):** a soma das vendas do mês mais a ruptura é igual à demanda.
- **Lotes (8) e (10):** as vendas de cada lote não ultrapassam a sua produção, $\varphi \cdot ATR_s \cdot q \cdot d_s$. O que sobra é a parcela $W_s$.
- **Cana (12):** a cana moída na safra não ultrapassa a cana disponível $C$.

A produção $P_t$, o estoque $E_t$ (Equação 11) e a sobra $W_s$ não são variáveis do otimizador. Eles são calculados pelas fórmulas da planilha a partir de $d_t$ e $x_{s,t}$.

**Resolução em duas etapas (otimização lexicográfica)**
1. **Etapa 1:** minimiza $\sum_t R_t$ e obtém a ruptura total mínima $Z^*$.
2. **Etapa 2:** acrescenta a restrição $\sum_t R_t \leq Z^* + 0{,}01$ (tolerância de 0,01 kg) e minimiza $\sum_t (13 - t)\,R_t$. Entre os planos com a mesma ruptura total, isso escolhe aquele em que a falta ocorre nos meses mais próximos do fim do horizonte.

Cada etapa tem limite de 60 segundos.

## Cenário de referência para conferência

Com os valores de referência, $\theta = 0\%$, distribuição uniforme, fator do ATR de 0%, $V = 6$, $E_0 = 0$, $C = 1.660$ t, $q = 9{,}1$ t/dia e $D = 15.000$ kg, o resultado deve ser:

| Indicador | Valor esperado |
|---|---|
| Status | OPTIMAL |
| Dias de moagem | 174 (todos os dias úteis de abril a novembro) |
| Cana moída | 1.583,4 t |
| Açúcar produzido na safra | 178.184 kg |
| Estoque ao final de novembro | 58.184 kg |
| Ruptura total $Z$ | 1.816 kg (1,0% da demanda anual), em março |
| Vendas fora da validade | 0 |

## Cenários de sensibilidade

Para cada cenário, altere **apenas um** parâmetro na aba Modelo, mantendo os demais nos valores de referência, e execute **Otimização → Resolver modelo** de novo.

| Parâmetro | Valores testados |
|---|---|
| $\theta$ (C10), com distribuição uniforme e com concentrada (C11) | 5%, 10%, 15% e 20% |
| Fator do ATR (C12) | −20%, −10% e +10% |
| Cana disponível $C$ (C9) | 1.458 t e 1.264 t |
| Validade $V$ (C7) | 4 e 12 meses |
| Estoque inicial $E_0$ (C8) | 15.000 kg e 30.000 kg |
| Moagem em dois sábados de setembro | Dias úteis de setembro (linha 21) de 22 para 24 |

## Como citar

> ANDRADE, Wesley Vieira Martins de. **Modelo-Solver-Acucar-Mascavo-TCC-**: modelo PLIM para planejamento da moagem e do estoque de açúcar mascavo. Versão 1.0. [S. l.]: GitHub, 2026. Disponível em:https://github.com/wes23dev/Modelo-Solver-Acucar-Mascavo-TCC- . Acesso em: [data].
