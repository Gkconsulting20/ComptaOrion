const nullableAuditColumns = ['user_id', 'enterprise_id'];

export function buildAuthAuditNullabilityStatements(columnRows) {
  const auditColumns = new Map(
    columnRows
      .filter((column) => column.table_name === 'audit_connexions')
      .map((column) => [column.column_name, column.is_nullable]),
  );

  for (const columnName of nullableAuditColumns) {
    if (!auditColumns.has(columnName)) {
      throw new Error(
        `Migration auth-audit annulée : audit_connexions.${columnName} est introuvable.`,
      );
    }
  }

  return nullableAuditColumns
    .filter((columnName) => {
      const nullable = auditColumns.get(columnName);
      if (nullable !== 'YES' && nullable !== 'NO') {
        throw new Error(
          `Migration auth-audit annulée : nullabilité inconnue pour audit_connexions.${columnName}.`,
        );
      }
      return nullable === 'NO';
    })
    .map(
      (columnName) =>
        `ALTER TABLE "audit_connexions" ALTER COLUMN "${columnName}" DROP NOT NULL`,
    );
}
