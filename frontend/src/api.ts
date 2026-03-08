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

// Card Details
export const getCardDetails = () => api.get('/cards').then(r => r.data);

// Audit
export const getAuditLogs = (params: Record<string, any>) =>
  api.get('/audit', { params }).then(r => r.data);
