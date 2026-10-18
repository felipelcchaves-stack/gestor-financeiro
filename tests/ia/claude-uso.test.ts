import { test } from "node:test";
import assert from "node:assert/strict";
import { linhaDeUso } from "../../src/lib/claude";

test("linha de uso traz entrada, saída e os dois campos de cache", () => {
  const linha = linhaDeUso(
    "claude-haiku-5-5",
    { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 800, cache_creation_input_tokens: 0 },
    "corte-geral"
  );
  assert.equal(
    linha,
    "[claude] corte-geral modelo=claude-haiku-5-5 entrada=1200 saida=300 cache_lido=800 cache_gravado=0"
  );
});

test("linha de uso tolera usage ausente ou campos nulos", () => {
  assert.equal(linhaDeUso("m", undefined), "[claude] chamada modelo=m entrada=0 saida=0 cache_lido=0 cache_gravado=0");
  assert.match(linhaDeUso("m", { input_tokens: 5, cache_read_input_tokens: null }), /entrada=5 saida=0 cache_lido=0/);
});
