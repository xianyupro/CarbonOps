"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate } from "@/lib/utils";
import type {
  Role,
  RoleDetail,
  User,
  UserCreatePayload,
  UserUpdatePayload,
} from "@/types/api";

const PAGE_SIZE = 20;

/** Map a role code to a Badge variant. */
function roleBadgeVariant(code: string): BadgeProps["variant"] {
  switch (code) {
    case "admin":
      return "destructive";
    case "engineer":
      return "default";
    case "viewer":
      return "secondary";
    default:
      return "secondary";
  }
}

/** Built-in admin account is protected from deletion. */
function isBuiltinAdmin(user: User): boolean {
  return user.username === "admin";
}

interface FormState {
  username: string;
  password: string;
  displayName: string;
  email: string;
  isActive: boolean;
  roleIds: number[];
}

const EMPTY_FORM: FormState = {
  username: "",
  password: "",
  displayName: "",
  email: "",
  isActive: true,
  roleIds: [],
};

export default function SystemUsersPage() {
  const hasWrite = useAuthStore((s) => s.hasPermission("system:user:write"));
  const hasDelete = useAuthStore((s) => s.hasPermission("system:user:delete"));

  const [items, setItems] = React.useState<User[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [roles, setRoles] = React.useState<RoleDetail[]>([]);

  const [keyword, setKeyword] = React.useState("");
  const [page, setPage] = React.useState(1);

  // Create / edit dialog
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<User | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);

  // Reset password dialog
  const [resetTarget, setResetTarget] = React.useState<User | null>(null);
  const [resetPwd, setResetPwd] = React.useState("");
  const [resetting, setResetting] = React.useState(false);

  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = React.useState<User | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function load(targetPage = page) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.users.list({
        page: targetPage,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
      });
      const list = Array.isArray(res) ? res : (res.list ?? []);
      const nextTotal = Array.isArray(res)
        ? list.length
        : (res.meta?.total ?? list.length);
      setItems(list);
      setTotal(nextTotal);
      if (targetPage > 1 && list.length === 0 && nextTotal > 0) {
        setPage(Math.max(1, Math.ceil(nextTotal / PAGE_SIZE)));
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "加载用户列表失败，请确认后端服务已启动"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // Initial load: fetch users + available roles.
  React.useEffect(() => {
    void load(1);
    api.users
      .roles()
      .then(setRoles)
      .catch(() => setRoles([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when page changes.
  React.useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (page === 1) {
      void load(1);
    } else {
      setPage(1);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  }

  function openEdit(user: User) {
    setEditing(user);
    setForm({
      username: user.username,
      password: "",
      displayName: user.displayName ?? "",
      email: user.email ?? "",
      isActive: user.isActive,
      roleIds: user.roles.map((r) => r.id),
    });
    setFormOpen(true);
  }

  function toggleRole(id: number) {
    setForm((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(id)
        ? prev.roleIds.filter((r) => r !== id)
        : [...prev.roleIds, id],
    }));
  }

  function openResetPassword(user: User) {
    setResetTarget(user);
    setResetPwd("");
  }

  async function handleSubmit() {
    const isEdit = !!editing;
    if (!isEdit) {
      if (!form.username.trim()) {
        toast.error("请输入用户名");
        return;
      }
      if (!form.password || form.password.length < 6) {
        toast.error("密码至少需要 6 位");
        return;
      }
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        const payload: UserUpdatePayload = {
          displayName: form.displayName.trim() || undefined,
          email: form.email.trim() || undefined,
          isActive: form.isActive,
          roleIds: form.roleIds,
        };
        await api.users.update(editing!.id, payload);
        toast.success(`已更新用户 ${editing!.username}`);
      } else {
        const payload: UserCreatePayload = {
          username: form.username.trim(),
          password: form.password,
          displayName: form.displayName.trim() || undefined,
          email: form.email.trim() || undefined,
          roleIds: form.roleIds,
        };
        const created = await api.users.create(payload);
        toast.success(`已创建用户 ${created.username}`);
      }
      setFormOpen(false);
      await load(page);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    if (!resetPwd || resetPwd.length < 6) {
      toast.error("密码至少需要 6 位");
      return;
    }
    setResetting(true);
    try {
      await api.users.resetPassword(resetTarget.id, resetPwd);
      toast.success(`已重置 ${resetTarget.username} 的密码`);
      setResetTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "重置密码失败");
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.users.delete(deleteTarget.id);
      toast.success(`已删除用户 ${deleteTarget.username}`);
      setDeleteTarget(null);
      await load(page);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showPrev = page > 1;
  const showNext = page < totalPages;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="系统管理 · Users"
        icon={Users}
        title="用户管理"
        description="管理平台用户、角色与权限分配"
        actions={
          hasWrite ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新建用户
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <form
            onSubmit={onSearchSubmit}
            className="relative flex flex-1 gap-2"
            role="search"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索用户名 / 姓名 / 邮箱…"
              className="pl-9"
              aria-label="搜索用户"
            />
            <Button type="submit" variant="secondary" disabled={loading}>
              搜索
            </Button>
          </form>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(page)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[26%]">用户信息</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>最近登录</TableHead>
              <TableHead className="w-[60px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-14" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-8" />
                  </TableCell>
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-sm text-destructive">
                    <Loader2 className="h-5 w-5" />
                    {error}
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-2">
                  <EmptyState
                    icon={Users}
                    title="暂无用户"
                    description="可调整搜索条件，或点击右上角新建用户"
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((user) => {
                const initial = (
                  user.displayName || user.username
                )
                  .charAt(0)
                  .toUpperCase();
                const protectedAdmin = isBuiltinAdmin(user);
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                            {initial}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">
                            {user.username}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {user.displayName || "—"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email || "—"}
                    </TableCell>
                    <TableCell>
                      {user.roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((r: Role) => (
                            <Badge
                              key={r.id}
                              variant={roleBadgeVariant(r.code)}
                            >
                              {r.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "success" : "muted"}>
                        {user.isActive ? "启用" : "已停用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(user.lastLoginAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {hasWrite ? (
                            <DropdownMenuItem
                              onSelect={() => openEdit(user)}
                            >
                              <Pencil className="h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                          ) : null}
                          {hasWrite ? (
                            <DropdownMenuItem
                              onSelect={() => openResetPassword(user)}
                            >
                              <KeyRound className="h-4 w-4" />
                              重置密码
                            </DropdownMenuItem>
                          ) : null}
                          {hasDelete ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={protectedAdmin}
                                onSelect={() => setDeleteTarget(user)}
                              >
                                <Trash2 className="h-4 w-4" />
                                删除
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          <span>
            共 <span className="font-medium text-foreground">{total}</span> 条
            {loading ? "（加载中）" : ""}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={!showPrev || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              上一页
            </Button>
            <span className="px-2 font-mono">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={!showNext || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(o) => {
          if (!submitting) setFormOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? (
                <>
                  <Pencil className="h-4 w-4" />
                  编辑用户
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  新建用户
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "更新用户资料、状态与角色绑定。用户名创建后不可修改。"
                : "填写用户基本信息并分配角色。"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Username */}
            <div className="grid gap-2">
              <Label htmlFor="user-username">用户名</Label>
              {editing ? (
                <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 font-mono text-sm text-muted-foreground">
                  {form.username}
                </div>
              ) : (
                <>
                  <Input
                    id="user-username"
                    value={form.username}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, username: e.target.value }))
                    }
                    placeholder="登录用户名，唯一"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    创建后不可修改，需保持唯一。
                  </p>
                </>
              )}
            </div>

            {/* Password (create only) */}
            {!editing ? (
              <div className="grid gap-2">
                <Label htmlFor="user-password">密码</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, password: e.target.value }))
                  }
                  placeholder="至少 6 位"
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">
                  密码长度至少 6 位。
                </p>
              </div>
            ) : null}

            {/* Display name */}
            <div className="grid gap-2">
              <Label htmlFor="user-displayName">姓名</Label>
              <Input
                id="user-displayName"
                value={form.displayName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, displayName: e.target.value }))
                }
                placeholder="显示名称（可选）"
              />
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="user-email">邮箱</Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="name@example.com（可选）"
              />
            </div>

            {/* Active status (edit only) */}
            {editing ? (
              <div className="flex items-center justify-between rounded-md border border-input px-3 py-2.5">
                <div className="space-y-0.5">
                  <Label htmlFor="user-active" className="cursor-pointer">
                    启用状态
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    停用后该用户将无法登录。
                  </p>
                </div>
                <Switch
                  id="user-active"
                  checked={form.isActive}
                  onCheckedChange={(v) =>
                    setForm((p) => ({ ...p, isActive: v }))
                  }
                />
              </div>
            ) : null}

            {/* Roles */}
            <div className="grid gap-2">
              <Label className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                角色分配
              </Label>
              {roles.length === 0 ? (
                <p className="rounded-md border border-dashed border-input px-3 py-2.5 text-xs text-muted-foreground">
                  暂无可分配角色。
                </p>
              ) : (
                <div className="grid gap-1.5 rounded-md border border-input p-3">
                  {roles.map((r) => {
                    const checked = form.roleIds.includes(r.id);
                    return (
                      <label
                        key={r.id}
                        className="flex cursor-pointer items-start gap-2.5"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleRole(r.id)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium leading-none">
                              {r.name}
                            </span>
                            <Badge
                              variant={roleBadgeVariant(r.code)}
                              className="font-mono text-[10px]"
                            >
                              {r.code}
                            </Badge>
                            {r.isBuiltin ? (
                              <span className="text-[10px] text-muted-foreground">
                                内置
                              </span>
                            ) : null}
                          </div>
                          {r.description ? (
                            <p className="text-xs text-muted-foreground">
                              {r.description}
                            </p>
                          ) : null}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <Separator />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  保存中…
                </>
              ) : editing ? (
                "保存修改"
              ) : (
                "创建用户"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog
        open={!!resetTarget}
        onOpenChange={(o) => {
          if (!resetting) setResetTarget(o ? resetTarget : null);
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              重置密码
            </DialogTitle>
            <DialogDescription>
              为用户「{resetTarget?.username}」设置新密码，操作立即生效。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="reset-password">新密码</Label>
            <Input
              id="reset-password"
              type="password"
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
              placeholder="至少 6 位"
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              新密码长度至少 6 位。
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetTarget(null)}
              disabled={resetting}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleResetPassword()}
              disabled={resetting}
            >
              {resetting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  重置中…
                </>
              ) : (
                "确认重置"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!deleting) setDeleteTarget(o ? deleteTarget : null);
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>确认删除用户</DialogTitle>
            <DialogDescription>
              此操作将永久删除用户「{deleteTarget?.username}」，并解除其角色
              与权限绑定，无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  删除中…
                </>
              ) : (
                "确认删除"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
