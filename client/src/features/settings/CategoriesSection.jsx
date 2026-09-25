import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Check, Pencil, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import * as categoriesApi from '@/api/categories';
import { IconBadge } from '@/components/common/NamedIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCategories } from '@/features/categories/useCategories';
import { cn } from '@/lib/utils';

function useCategoryMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['categories'] });
  const onError = (error) => toast.error(error.message);
  return {
    create: useMutation({ mutationFn: categoriesApi.createCategory, onSuccess: refresh, onError }),
    update: useMutation({
      mutationFn: ({ id, changes }) => categoriesApi.updateCategory(id, changes),
      onSuccess: refresh,
      onError,
    }),
  };
}

function CategoryRow({ category, onRename, onArchive }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const save = () => {
    if (name.trim() && name.trim() !== category.name) onRename(name.trim());
    setEditing(false);
  };
  return (
    <li className={cn('flex items-center gap-3 py-2', category.isArchived && 'opacity-60')}>
      <IconBadge icon={category.icon} color={category.color} />
      {editing ? (
        <Input
          aria-label={`New name for ${category.name}`}
          value={name}
          maxLength={40}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="h-8 flex-1"
        />
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm">
          {category.name}
          {category.isArchived && <Badge variant="secondary">Hidden</Badge>}
        </span>
      )}
      {editing ? (
        <>
          <Button size="icon-sm" variant="ghost" aria-label="Save name" onClick={save}>
            <Check aria-hidden="true" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Cancel"
            onClick={() => setEditing(false)}
          >
            <X aria-hidden="true" />
          </Button>
        </>
      ) : (
        <>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Rename ${category.name}`}
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={
              category.isArchived ? `Show ${category.name} again` : `Hide ${category.name}`
            }
            onClick={onArchive}
          >
            {category.isArchived ? (
              <ArchiveRestore aria-hidden="true" />
            ) : (
              <Archive aria-hidden="true" />
            )}
          </Button>
        </>
      )}
    </li>
  );
}

// Add your own categories, rename any, and hide ones you don't use (old payments keep them).
export function CategoriesSection() {
  const { data: categories = [] } = useCategories();
  const { create, update } = useCategoryMutations();
  const [type, setType] = useState('expense');
  const [name, setName] = useState('');

  const shown = categories.filter((c) => c.type === type && !c.parentId);

  const add = (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), type },
      {
        onSuccess: (saved) => {
          toast.success(`Added "${saved.name}"`);
          setName('');
        },
      },
    );
  };

  return (
    <section aria-label="Categories" className="surface grid gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Categories</h2>
        <div
          role="tablist"
          aria-label="Category type"
          className="grid grid-cols-2 gap-1 rounded-xl bg-muted/80 p-1"
        >
          {['expense', 'income'].map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={type === value}
              onClick={() => setType(value)}
              className={cn(
                'rounded-lg px-3 py-1 text-sm font-medium transition-colors',
                type === value ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              {value === 'expense' ? 'Money out' : 'Money in'}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={add} className="flex gap-2">
        <Input
          aria-label="New category name"
          placeholder={type === 'expense' ? 'e.g. Pets' : 'e.g. Tuition income'}
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={!name.trim() || create.isPending}>
          <Plus aria-hidden="true" />
          Add
        </Button>
      </form>

      <ul
        aria-label={`${type === 'expense' ? 'Money out' : 'Money in'} categories`}
        className="divide-y"
      >
        {shown.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            onRename={(newName) =>
              update.mutate(
                { id: category.id, changes: { name: newName } },
                { onSuccess: () => toast.success(`Renamed to "${newName}"`) },
              )
            }
            onArchive={() =>
              update.mutate(
                { id: category.id, changes: { isArchived: !category.isArchived } },
                {
                  onSuccess: () =>
                    toast.success(
                      category.isArchived
                        ? `"${category.name}" is back`
                        : `"${category.name}" hidden`,
                    ),
                },
              )
            }
          />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Hidden categories stay on old payments but aren’t offered for new ones.
      </p>
    </section>
  );
}
