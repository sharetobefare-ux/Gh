#!/bin/sh
# يبني نسخة ثابتة تعمل بلا خادم: الواجهة + الخلفية داخل المتصفح (لأغراض العرض فقط).
# صفحة الدخول تُنشر باسم start.html وتحمّل التطبيق في نفس المستند.
set -e
OUT=${1:-dist}; rm -rf "$OUT"; mkdir -p "$OUT/shared"
cp -r web/. "$OUT"/; cp server/matching/engine.js "$OUT/shared/engine.js"
cp "${BB:-../bb}/browser-backend.js" "$OUT/browser-backend.js"
mv "$OUT/index.html" "$OUT/start.html"
sed -i 's#<script src="login.js"></script>#<script src="browser-backend.js"></script><script src="login.js"></script>#' "$OUT/start.html"
rm -rf "$OUT/app/index.html"
grep -q browser-backend "$OUT/start.html"
