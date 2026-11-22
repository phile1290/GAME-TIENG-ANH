import React, { useState, useEffect } from 'react';
import {
  getStoredGeminiApiKey,
  saveGeminiApiKey,
  testGeminiApiKey,
} from '../services/geminiClientService';
import { KeyRound, CheckCircle2, AlertCircle, X, RefreshCw, ShieldCheck } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  useEffect(() => {
    if (isOpen) {
      setApiKeyInput(getStoredGeminiApiKey());
      setStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndTest = async () => {
    const clean = apiKeyInput.trim();
    saveGeminiApiKey(clean);
    if (!clean) {
      setStatus({
        type: 'success',
        message: 'Đã xóa khóa cá nhân và chuyển về cấu hình mặc định của hệ thống.',
      });
      return;
    }

    setIsTesting(true);
    setStatus(null);
    const res = await testGeminiApiKey(clean);
    setIsTesting(false);
    setStatus({
      type: res.success ? 'success' : 'error',
      message: res.message,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-white">CÀI ĐẶT KẾT NỐI AI GEMINI</h3>
              <p className="text-xs text-amber-300 font-bold">
                Ứng dụng được phát triển bởi cô giáo Văn Thị Thuỳ Trang
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p className="flex items-center gap-1.5 text-emerald-300 font-bold">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Hỗ trợ tạo bộ câu hỏi Tiếng Anh Tiểu học tự động (Model gemini-3-flash-preview)</span>
          </p>
          <p>
            Nếu hệ thống đã có sẵn khóa môi trường hoặc giáo viên sử dụng chức năng{' '}
            <strong>Tạo bộ câu hỏi từ người dùng cung cấp (File .CSV / .TXT / .JSON)</strong> thì không bắt buộc nhập mục này.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
            Khóa Gemini API (Tùy chọn):
          </label>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
          />
        </div>

        {status && (
          <div
            className={`p-3 rounded-xl text-xs font-bold flex items-start gap-2 border ${
              status.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200'
                : 'bg-rose-950/70 border-rose-500 text-rose-200'
            }`}
          >
            {status.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <span>{status.message}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSaveAndTest}
            disabled={isTesting}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow"
          >
            {isTesting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>Lưu & Kiểm Tra Kết Nối</span>
          </button>
        </div>
      </div>
    </div>
  );
};
