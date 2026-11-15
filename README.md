<p align="center"><img src="store/icon-512.png" width="120" alt="Zeus SDOCX"></p>

# Zeus SDOCX

Samsung Notes (`.sdocx`) dosyasını **el yazısı notlar üstte kalacak şekilde PDF'e** çevirir ve **ses kaydını ayrı dosya olarak** çıkarır. Tamamen çevrimdışı çalışır, hiçbir şey internete gönderilmez.

*Made by Zeus*

## APK indirme
GitHub'da **Actions → Build APK → son çalışma → Artifacts → ZeusSDOCX-apk**. Telefonda "bilinmeyen kaynaklardan yükle" izni gerekir. Dosyalar `İndirilenler/ZeusSDOCX` klasörüne kaydedilir.

## Yapı
- `web/` arayüz ve dönüştürme mantığı (tek kaynak; Android bunu `assets` olarak paketler)
- `android/` WebView kabuğu (Kotlin): dosya seçici ve kaydetme köprüsü
- `.github/workflows/build-apk.yml` APK'yı GitHub'da derler (Android Studio gerekmez)

## Sınırlar
`.sdocx` formatı resmi değildir, tersine mühendislikle çözülmüştür. Bazı araçlar (şekil, vurgulayıcı vb.) eksik olabilir. Her zaman orijinal dosyayı sakla.

## Lisans ve emeği geçenler
GPL-3.0 (bkz. `LICENSE`). Çözücü motor: [twangodev/sdocx](https://github.com/twangodev/sdocx) (GPL-3.0, WASM derlemesi). Ayrıca [JSZip](https://stuk.github.io/jszip/) ve [pdf-lib](https://pdf-lib.js.org/) (MIT) kullanılır.
