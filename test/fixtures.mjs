// Bilingual test fixtures — heavy on mixed Persian/English bidi edge cases.

export const MIXED_PROMPT = `این یک prompt برای AI agent است که باید یک Android application بسازد.
The agent should follow these steps: 1) parse the config, 2) build the UI.
آدرس مستندات: https://docs.example.com/setup?v=2&id=1052 را هم ببینید.
Version 3.5.1 از کتابخانه retrofit2 را اضافه کن:
implementation("com.squareup.retrofit2:retrofit:2.9.0")
⚠️ توجه: توکن API را در فایل local.properties بگذارید، نه در git.
Numbers: 12345 and Persian digits ۱۲۳۴۵ mixed with 67.89%.
Symbols: ≠ ≤ ≥ → ← ✓ ✗ ★ and math ∑ f(i) = i² for i in [1, 10].
Emojis: 🎯 🚀 ✅ 👨‍👩‍👧‍👦 and flags 🇮🇷 🇺🇸.
"A quoted English sentence inside Persian text" — نقل قول داخلی.
کد کوتاه: const x = "سلام"; // Persian comment in code`;

export const PURE_PERSIAN = `سلام دنیا!
این یک متن کاملاً فارسی است که برای تست جهت راست‌به‌چپ نوشته شده است.
اعداد فارسی: ۰۱۲۳۴۵۶۷۸۹ و علائم نگارشی: ، ؛ ؟ !
پاراگراف دوم درباره‌ی هیچ موضوع خاصی نیست، فقط متن آزمایشی است.`;

export const PURE_ENGLISH = `The quick brown fox jumps over the lazy dog.
This is a pure English text for LTR testing purposes.
Line 3: special chars & <tags> "quotes" 'apostrophes' | pipe \\ backslash / slash
Line 4: unicode punctuation — – … « » „ “ ”`;

export const CODE_SNIPPET = `# Python code with mixed comments
import requests  # کتابخانه requests برای HTTP

def fetch_data(url: str) -> dict:
    """دریافت داده از سرور — fetch data from server"""
    response = requests.get(url, timeout=30)  # مهلت ۳۰ ثانیه
    if response.status_code == 200:  # کد موفق
        return response.json()
    raise RuntimeError(f"HTTP {response.status_code} — خطا در دریافت")

URL = "https://api.example.com/v2/data?lang=fa&limit=100"
print(fetch_data(URL))  # چاپ نتیجه`;

export const MARKDOWN_DOC = `# عنوان: mixed markdown doc
## Section عناوین فرعی

- **bold** و **ضخیم**
- \`code span\` و \`کد درون‌خطی\`
- [link](https://example.com) و [پیوند](https://example.org/fa)

> نقل قول: this is a blockquote با متن فارسی

| ستون ۱ | Column 2 |
|--------|----------|
| مقدار  | value    |

1. مرحله اول — first step
2. مرحله دوم — second step`;

/** 850-line mixed document to stress long-text handling. */
export function longDocument(lines = 850) {
  const out = [];
  out.push('— START OF LONG MIXED DOCUMENT — شروع سند بلند —');
  for (let i = 1; i <= lines; i++) {
    switch (i % 7) {
      case 0:
        out.push(`${i}. این خط شماره ${i} است و متن فارسی دارد برای تست.`);
        break;
      case 1:
        out.push(`Line ${i}: English text with URL https://example.com/page/${i}?q=test and number ${i * 37}.`);
        break;
      case 2:
        out.push(`خط ${i} ترکیبی: the value of X equals ${i * 11} در این حالت.`);
        break;
      case 3:
        out.push(`#include <header${i % 20}.h>  // کامنت فارسی در کد`);
        break;
      case 4:
        out.push(`✅ item ${i} done — مورد ${i} انجام شد ✅`);
        break;
      case 5:
        out.push(`const result_${i} = compute(${i}, "mode-${i % 5}"); // محاسبه`);
        break;
      default:
        out.push(`متن ${i}: نمادهای ∑ ≠ → ≤ ≥ و ایموجی 🎯 در خط ${i}.`);
    }
  }
  out.push('— END OF LONG MIXED DOCUMENT — پایان سند —');
  return out.join('\n');
}

export const ALL_FIXTURES = [
  { key: 'mixed-prompt', title: 'AI Agent Prompt — پرامپت هوش مصنوعی', content: MIXED_PROMPT, tags: ['AI Prompts', 'Android'] },
  { key: 'pure-persian', title: 'متن فارسی خالص', content: PURE_PERSIAN, tags: ['Notes'] },
  { key: 'pure-english', title: 'English Notes', content: PURE_ENGLISH, tags: ['Notes'] },
  { key: 'code', title: 'Python fetch_data — کد پایتون', content: CODE_SNIPPET, tags: ['Code', 'Python'] },
  { key: 'markdown', title: 'Markdown mixed doc', content: MARKDOWN_DOC, tags: ['Notes'] },
  { key: 'long', title: 'Long mixed document — 850 lines', content: longDocument(), tags: ['Temporary'] },
];
