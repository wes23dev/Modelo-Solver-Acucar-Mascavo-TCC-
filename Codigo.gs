/**
 * Resolve o modelo PLIM do TCC (Seção 4.2) direto no Google Planilhas,
 * usando o serviço de otimização linear do Google (LinearOptimizationService).
 *
 * O script lê os parâmetros da aba "Modelo", monta o mesmo modelo das
 * Equações (5) a (12), resolve e escreve a solução nas células verdes:
 *   - dias de moagem: C25:N25
 *   - vendas por lote: C35:N43
 * As fórmulas da planilha calculam o resto (ruptura, estoque, conferências).
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Otimização')
    .addItem('Resolver modelo', 'resolverModelo')
    .addToUi();
}

function resolverModelo() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Modelo');
  var NMES = 12, NSAFRA = 8, NLOTES = 9, GRANDE = 1e9;

  // ---------- Parâmetros (lidos da aba Modelo) ----------
  var phi = Number(sh.getRange('C5').getValue());   // φ
  var q   = Number(sh.getRange('C6').getValue());   // t de cana por dia
  var V   = Number(sh.getRange('C7').getValue());   // validade (meses)
  var E0  = Number(sh.getRange('C8').getValue());   // estoque inicial (kg)
  var C   = Number(sh.getRange('C9').getValue());   // cana disponível (t)
  var atr  = sh.getRange('C20:N20').getValues()[0]; // ATR usado
  var disp = sh.getRange('C24:N24').getValues()[0]; // dias disponíveis (Uₜ − Lₜ)
  var dem  = sh.getRange('C28:N28').getValues()[0]; // demanda

  var atrBase = sh.getRange('C19:J19').getValues()[0];
  var preenchidos = atrBase.filter(function (v) { return v !== '' && v !== null; }).length;
  if (preenchidos < NSAFRA) {
    aviso(sh, 'Preencha os 8 valores de ATR (linha 19) antes de resolver.');
    return;
  }

  // Etapa 1: minimiza a ruptura total (Eq. 5).
  var etapa1 = resolver(1, null);
  if (!etapa1.sol.isValid()) {
    aviso(sh, 'Não encontrou solução. Status: ' + etapa1.sol.getStatus());
    return;
  }
  var zTotal = etapa1.sol.getObjectiveValue();
  // Etapa 2 (desempate): mantém a mesma ruptura total e empurra a falta
  // para os meses mais tardios, minimizando a soma de (13 − t)·Rₜ.
  var etapa2 = resolver(2, zTotal);
  var final = etapa2.sol.isValid() ? etapa2 : etapa1;
  var sol = final.sol, pares = final.pares;

  // ---------- Escrever a solução nas células verdes ----------
  var dias = [];
  for (var t = 1; t <= NMES; t++) {
    dias.push(t <= NSAFRA ? Math.round(sol.getVariableValue('d' + t)) : 0);
  }
  sh.getRange('C25:N25').setValues([dias]);

  var X = [];
  for (var s = 0; s < NLOTES; s++) {
    var linha = [];
    for (t = 1; t <= NMES; t++) linha.push(0);
    X.push(linha);
  }
  for (var i = 0; i < pares.length; i++) {
    var v = sol.getVariableValue(nomeX(pares[i][0], pares[i][1]));
    X[pares[i][0]][pares[i][1] - 1] = Math.abs(v) < 1e-6 ? 0 : v;
  }
  sh.getRange('C35:N43').setValues(X);
  SpreadsheetApp.flush();

  aviso(sh, 'Status: ' + etapa1.sol.getStatus() + ' | Ruptura total = ' + Math.round(zTotal) +
            ' kg | Desempate: ' + (etapa2.sol.isValid() ? 'ok' : 'não aplicado'));

  function resolver(etapa, zMax) {
  var eng = LinearOptimizationService.createEngine();

  // ---------- Variáveis ----------
  // dₜ: dias de moagem, inteiros, entre 0 e os dias disponíveis (Eq. 6 e 7)
  for (var t = 1; t <= NSAFRA; t++) {
    eng.addVariable('d' + t, 0, Math.max(Number(disp[t - 1]), 0),
                    LinearOptimizationService.VariableType.INTEGER);
  }
  // Rₜ: ruptura (≥ 0); a função objetivo é a soma das rupturas (Eq. 5)
  for (t = 1; t <= NMES; t++) {
    eng.addVariable('R' + t, 0, GRANDE);
    eng.setObjectiveCoefficient('R' + t, etapa === 1 ? 1 : 13 - t);
  }
  // xₛ,ₜ: vendas do lote s no mês t, só nos pares do conjunto K (validade)
  function ultimoMes(s) { return s === 0 ? V - 4 : s + V; }   // τₛ
  var pares = [];
  for (var s = 0; s < NLOTES; s++) {
    for (t = Math.max(s, 1); t <= Math.min(ultimoMes(s), NMES); t++) {
      eng.addVariable(nomeX(s, t), 0, GRANDE);
      pares.push([s, t]);
    }
  }

  // ---------- Restrições ----------
  // Eq. (9): vendas do mês + ruptura = demanda
  for (t = 1; t <= NMES; t++) {
    var r9 = eng.addConstraint(Number(dem[t - 1]), Number(dem[t - 1]));
    r9.setCoefficient('R' + t, 1);
    for (var i = 0; i < pares.length; i++) {
      if (pares[i][1] === t) r9.setCoefficient(nomeX(pares[i][0], t), 1);
    }
  }
  // Eq. (10) + Eq. (8): o que se vende do lote s não passa do que foi produzido
  for (s = 0; s < NLOTES; s++) {
    var r10 = eng.addConstraint(-GRANDE, s === 0 ? E0 : 0);
    for (i = 0; i < pares.length; i++) {
      if (pares[i][0] === s) r10.setCoefficient(nomeX(s, pares[i][1]), 1);
    }
    if (s >= 1) r10.setCoefficient('d' + s, -phi * Number(atr[s - 1]) * q);
  }
  // Eq. (12): cana moída na safra ≤ cana disponível
  var r12 = eng.addConstraint(-GRANDE, C);
  for (t = 1; t <= NSAFRA; t++) r12.setCoefficient('d' + t, q);

  // Etapa 2: a ruptura total não pode passar da encontrada na etapa 1
  if (etapa === 2) {
    var rz = eng.addConstraint(-GRANDE, zMax + 0.01);
    for (t = 1; t <= NMES; t++) rz.setCoefficient('R' + t, 1);
  }

  eng.setMinimization();
  return { sol: eng.solve(60), pares: pares };
  }
}

function nomeX(s, t) { return 'x' + s + '_' + t; }

function aviso(sh, msg) {
  sh.getRange('B67').setValue('Status do otimizador (último Resolver)');
  sh.getRange('C67').setValue(msg);
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'Otimização', 10);
}
