import React, { useState, useEffect } from "react";
import { Key, CheckCircle, AlertTriangle, Eye, EyeOff, ExternalLink, RefreshCw, X } from "lucide-react";
import { getGeminiApiKey, setGeminiApiKey, getGeminiApiKeyStatus, testGeminiApiKey } from "../services/geminiService";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onKeySaved }) => {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState(getGeminiApiKeyStatus());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const currentStatus = getGeminiApiKeyStatus();
      setStatus(currentStatus);
      const currentKey = getGeminiApiKey();
      setApiKeyInput(currentStatus.source === "custom" ? currentKey : "");
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed && status.source !== "env") {
      alert("Vui lòng nhập Google Gemini API Key.");
      return;
    }
    if (trimmed) {
      setGeminiApiKey(trimmed);
    }
    const newStatus = getGeminiApiKeyStatus();
    setStatus(newStatus);
    if (onKeySaved) onKeySaved();
    onClose();
  };

  const handleRemove = () => {
    setGeminiApiKey("");
    setApiKeyInput("");
    setStatus(getGeminiApiKeyStatus());
    setTestResult(null);
    if (onKeySaved) onKeySaved();
  };

  const handleTestConnection = async () => {
    const keyToTest = apiKeyInput.trim() || getGeminiApiKey();
    if (!keyToTest) {
      setTestResult({ success: false, message: "Vui lòng nhập API Key để kiểm tra kết nối." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testGeminiApiKey(keyToTest);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || "Không thể kết nối đến Google Gemini." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden"
        role="dialog" 
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="bg-linear-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-white/20 p-2 rounded-lg">
              <Key className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Cài đặt Google Gemini API Key</h3>
              <p className="text-xs text-blue-100">Cấu hình API Key để soạn bài khi chạy độc lập trên Vercel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Status Alert */}
          {status.hasKey ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-semibold text-emerald-900">
                  {status.source === "env" 
                    ? "Đã nhận API Key từ biến môi trường (Vercel GEMINI_API_KEY)" 
                    : "Đã lưu API Key cá nhân trong trình duyệt"}
                </div>
                <div className="text-emerald-700 font-mono text-[11px]">
                  Khóa hiện tại: {status.maskedKey}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 space-y-1">
                <div className="font-semibold">Chưa có API Key</div>
                <div>Vui lòng nhập API Key của bạn bên dưới để ứng dụng gọi trực tiếp Google Gemini API.</div>
              </div>
            </div>
          )}

          {/* Input field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Google Gemini API Key:</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 text-[11px]"
              >
                <span>Lấy API Key miễn phí tại Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </label>
            <div className="relative flex items-center">
              <input
                type={showKey ? "text" : "password"}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={status.hasKey ? "Dán khóa mới để thay đổi..." : "AIzaSy..."}
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                title={showKey ? "Ẩn khóa" : "Hiện khóa"}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Test Result Message */}
          {testResult && (
            <div className={`rounded-xl p-3 text-xs flex items-start gap-2.5 ${
              testResult.success 
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800" 
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}>
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="font-medium">{testResult.message}</div>
            </div>
          )}

          {/* Guide / Instructions */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 space-y-2">
            <div className="font-semibold text-slate-700 flex items-center gap-1.5">
              <span>💡 Hướng dẫn triển khai trên Vercel:</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
              <li>
                <strong>Cách 1 (Nhanh nhất):</strong> Nhập API Key vào ô trên và bấm <em>Lưu API Key</em>. Khóa được lưu an toàn trong trình duyệt của bạn.
              </li>
              <li>
                <strong>Cách 2 (Tự động trên Vercel):</strong> Truy cập Vercel Dashboard &rarr; Project Settings &rarr; <em>Environment Variables</em> &rarr; Thêm biến tên <code>GEMINI_API_KEY</code> với giá trị là API Key của bạn. Ứng dụng sẽ tự động nhận diện mà không cần nhập lại!
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || (!apiKeyInput.trim() && !status.hasKey)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin text-blue-600" : ""}`} />
            <span>{testing ? "Đang kiểm tra..." : "Kiểm tra kết nối"}</span>
          </button>

          <div className="flex items-center gap-2">
            {status.source === "custom" && (
              <button
                type="button"
                onClick={handleRemove}
                className="px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
              >
                Xóa khóa đã lưu
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs shadow-blue-200 transition-all"
            >
              Lưu API Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
