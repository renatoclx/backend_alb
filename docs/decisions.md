# Decisões Técnicas

Este documento registra decisões de design que não são óbvias a partir do código ou das regras de negócio, para evitar retrabalho ou dúvidas futuras.

## Client — não reutilização de email/document após soft delete

- Ao remover um cliente (soft delete), os valores de `email` e `document` já utilizados não podem ser reaproveitados por outro cadastro.
- Diferente do padrão comum de soft delete (índice único parcial permitindo reuso após remoção), aqui a constraint de unicidade permanece válida mesmo para registros removidos.
- Motivo: regra de negócio explícita em `business-rules.md`.

## Category — exclusão física

- Quando uma categoria não possui produtos vinculados, sua exclusão é física (hard delete), não soft delete.
- Diferente da regra padrão de soft delete (`database.md`), pois não há histórico a preservar nesse cenário.
- Category é, portanto, uma exceção documentada à regra geral de soft delete.

## User — dois estados de remoção (isActive + deletedAt)

- Inativação (`isActive = false`) e exclusão (`deletedAt` preenchido) são estados distintos.
- Um usuário só pode ser excluído (soft delete) se já estiver inativo.
- Usuários excluídos não aparecem na consulta padrão, assim como ocorre com Client.
- Um usuário inativado pode ser reativado (`isActive` volta a `true`), desde que não tenha sido removido.

## Sale / Rental — preço snapshot no momento da transação

- `SaleItem.unitPrice` e `RentalItem.unitPrice` são gravados a partir de `Product.salePrice`/`Product.rentalPrice` no momento da criação da venda/locação.
- Alterações posteriores no preço do produto não afetam vendas/locações já registradas — o valor histórico fica preservado no item.

## Sale / Rental — sem cancelamento ou exclusão nesta etapa

- Vendas e locações são registros imutáveis uma vez criados: não há endpoint de atualização, cancelamento ou exclusão.
- Motivo: escopo desta etapa é apenas o registro básico da transação (venda/locação) e da devolução (no caso de locação). Um fluxo de cancelamento com estorno de estoque fica para uma etapa futura.
- Por não terem exclusão, Sale/SaleItem/Rental/RentalItem não utilizam `deletedAt` (exceção documentada em `database.md`).

## Rental — preço fechado por unidade (sem tarifação por período)

- `RentalItem.unitPrice` é um valor fechado por unidade locada, aplicado independentemente da duração da locação (dias entre `startDate` e a devolução).
- O negócio real prevê tarifação por período solicitado (1 dia, 1 semana, 1 mês etc., cada um com valor próprio), mas essa complexidade foi conscientemente adiada para uma versão futura — ver `technical-debt.md`.

## Sale / Rental — decremento e reposição de estoque

- Ao criar uma venda ou locação, `Product.quantity` é decrementado atomicamente (via `updateMany` condicionado a `quantity >= solicitado`, dentro de uma transação), bloqueando a operação com erro caso o estoque seja insuficiente.
- Ao devolver uma locação, o estoque dos produtos da locação é reposto (`quantity` incrementado). Vendas não têm devolução, portanto nunca repõem estoque.
- `Product.minimalQuantity` continua sendo apenas informativo — não bloqueia vendas/locações mesmo que o estoque resultante fique abaixo do mínimo.
