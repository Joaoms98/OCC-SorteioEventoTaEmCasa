interface PaginationProps {
  page: number;
  totalPages: number;
  onChange(page: number): void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Paginação">
      <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </button>
      <span>
        Página {page} de {totalPages}
      </span>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Próxima
      </button>
    </nav>
  );
}
