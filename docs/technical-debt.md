# Débitos Técnicos

Este documento registra simplificações conscientes feitas para viabilizar a entrega atual, que deverão ser revisitadas em versões futuras.

## Rental — tarifação por período (dia/semana/mês)

- **Situação atual**: `RentalItem.unitPrice` é um valor fechado por unidade locada (`Product.rentalPrice`), independente de quanto tempo o produto fica locado.
- **Necessidade real do negócio**: o aluguel pode ser feito por período solicitado (1 dia, 1 semana, 1 mês, etc.), cada um com um valor específico.
- **Por que foi adiado**: implementar tarifação por período exige repensar o modelo de preços do `Product` (hoje um único campo `rentalPrice`) para suportar múltiplas tarifas por período, além de definir como o período solicitado é escolhido/calculado no cadastro da locação. Essa modelagem foi conscientemente deixada para uma próxima versão, para não bloquear a entrega das operações básicas de Sale/Rental.
- **Impacto**: o valor cobrado por uma locação hoje não reflete corretamente o prazo da locação; é o mesmo valor independente de o cliente devolver no dia seguinte ou um mês depois.
- **Próximo passo sugerido**: adicionar tarifas por período ao `Product` (ex.: `dailyRentalPrice`, `weeklyRentalPrice`, `monthlyRentalPrice`, ou uma tabela de tarifas), e permitir que o cadastro da `Rental` informe o período contratado, recalculando `unitPrice`/`total` de acordo.

## Sale / Rental — sem cancelamento

- **Situação atual**: vendas e locações são imutáveis após criadas; não há endpoint de cancelamento/exclusão.
- **Necessidade potencial**: corrigir um cadastro incorreto hoje exige intervenção manual no banco, já que não existe fluxo de cancelamento que também estorne o estoque debitado.
- **Próximo passo sugerido**: avaliar, junto ao negócio, se deve existir um fluxo de cancelamento (com reposição de estoque) para Sale, similar ao que já existe para devolução de Rental.
