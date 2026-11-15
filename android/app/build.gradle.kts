plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "dev.zeus.sdocx"
    compileSdk = 34
    defaultConfig { applicationId = "dev.zeus.sdocx"; minSdk = 29; targetSdk = 34; versionCode = 1; versionName = "1.0" }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    // Web arayüzü tek kaynaktan gelir: repo/web
    sourceSets["main"].assets.srcDirs("src/main/assets", "../../web")
}
dependencies { implementation("androidx.webkit:webkit:1.11.0") }
