function serialize(row) {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    value: row.value_cents / 100,
    type: row.type,
    installment: row.installment,
    installmentTotal: row.installment_total,
    categoryId: row.category_id,
    bankId: row.bank_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = { serialize };
