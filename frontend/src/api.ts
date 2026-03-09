import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const getFolders = () => api.get('/upload/folders').then(r => r.data);
export const parseFolder = (name: string) => api.post(`/upload/parse/${name}`).then(r => r.data);

export const getTransactions = (params: Record<string, any>) =>
  api.get('/transactions', { params }).then(r => r.data);
export const updateTransaction = (id: number, data: Record<string, any>) =>
  api.patch(`/transactions/${id}`, data).then(r => r.data);
export const deleteTransaction = (id: number) =>
  api.delete(`/transactions/${id}`).then(r => r.data);

export const getSummary = (params: Record<string, any>) =>
  api.get('/dashboard/summary', { params }).then(r => r.data);
export const getByCategory = (params: Record<string, any>) =>
  api.get('/dashboard/by-category', { params }).then(r => r.data);
export const getMonthlyTrend = (params: Record<string, any>) =>
  api.get('/dashboard/monthly-trend', { params }).then(r => r.data);
export const getTopMerchants = (params: Record<string, any>) =>
  api.get('/dashboard/top-merchants', { params }).then(r => r.data);
export const getByAccount = (params: Record<string, any>) =>
  api.get('/dashboard/by-account', { params }).then(r => r.data);

export const getCategories = () => api.get('/categories').then(r => r.data);
export const createCategory = (data: { name: string; color?: string; icon?: string }) =>
  api.post('/categories', data).then(r => r.data);
export const updateCategory = (id: number, data: { name?: string; color?: string; icon?: string }) =>
  api.put(`/categories/${id}`, data).then(r => r.data);
export const deleteCategory = (id: number) => api.delete(`/categories/${id}`).then(r => r.data);
export const getRules = () => api.get('/categories/rules').then(r => r.data);
export const createRule = (data: { keyword: string; category_id: number }) =>
  api.post('/categories/rules', data).then(r => r.data);
export const deleteRule = (id: number) => api.delete(`/categories/rules/${id}`).then(r => r.data);
export const recategorize = () => api.post('/categories/recategorize').then(r => r.data);

// Credit Cards
export const getCreditCardAccounts = () => api.get('/creditcards/accounts').then(r => r.data);
export const getCreditCardCycles = () => api.get('/creditcards/cycles').then(r => r.data);
export const getCreditCardAnalytics = (params: { cycle: string; account_id?: number }) =>
  api.get('/creditcards/analytics', { params }).then(r => r.data);

// EMIs
export const getEmis = () => api.get('/emis').then(r => r.data);
export const updateEmi = (id: number, data: Record<string, any>) => api.patch(`/emis/${id}`, data).then(r => r.data);
export const deleteEmi = (id: number) => api.delete(`/emis/${id}`).then(r => r.data);
export const getEmiAttachments = () => api.get('/emis/attachments').then(r => r.data);
export const createEmiAttachments = (data: { emi_id: number; cycle: string; transaction_ids: number[] }) =>
  api.post('/emis/attachments', data).then(r => r.data);
export const deleteEmiAttachment = (id: number) => api.delete(`/emis/attachments/${id}`).then(r => r.data);

// Card Details
export const getCardDetails = () => api.get('/cards').then(r => r.data);

// Audit
export const getAuditLogs = (params: Record<string, any>) =>
  api.get('/audit', { params }).then(r => r.data);

// Accounts
export const patchAccount = (id: number, data: { glyph?: string }) =>
  api.patch(`/accounts/${id}`, data).then(r => r.data);

// Tags
export const getTags = () => api.get('/tags').then(r => r.data);
export const patchTag = (name: string, data: { type?: string; color?: string | null }) =>
  api.patch(`/tags/${encodeURIComponent(name)}`, data).then(r => r.data);
export const deleteTag = (name: string) =>
  api.delete(`/tags/${encodeURIComponent(name)}`).then(r => r.data);
export const runAutoTag = () => api.post('/tags/auto-tag').then(r => r.data);
export const listBackups = () => api.get('/backup/list').then(r => r.data);
export const createBackup = () => api.post('/backup/create').then(r => r.data);
export const restoreBackup = (name: string) => api.post(`/backup/restore/${encodeURIComponent(name)}`).then(r => r.data);
export const cleanData = (entities?: string[]) => api.post('/backup/clean', entities ? entities : undefined).then(r => r.data);
