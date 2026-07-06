plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val apiEnv = (project.findProperty("apiEnv") as String? ?: "local").trim().lowercase()
val apiBaseUrl = (project.findProperty("apiBaseUrl") as String?)?.trim()?.takeIf { it.isNotEmpty() }
    ?: when (apiEnv) {
        "staging" -> (project.findProperty("apiBaseUrlStaging") as String? ?: "https://staging.example.com/api/v1")
        "prod" -> (project.findProperty("apiBaseUrlProd") as String? ?: "https://api.example.com/api/v1")
        else -> (project.findProperty("apiBaseUrlLocal") as String? ?: "http://10.0.2.2:3001/api/v1")
    }

android {
    namespace = "com.iptvagao.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.iptvagao.tv"
        minSdk = 22
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
        buildConfigField("String", "API_ENVIRONMENT", "\"$apiEnv\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.09.03")
    implementation(composeBom)

    implementation("androidx.activity:activity-compose:1.9.2")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.compose.material3:material3")
    // Ícones extra (Tv, Movie) além do core set (Search/Star/AccountCircle já incluído no core)
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.6")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Player
    implementation("androidx.media3:media3-exoplayer:1.4.1")
    implementation("androidx.media3:media3-exoplayer-hls:1.4.1")
    implementation("androidx.media3:media3-ui:1.4.1")

    // Network
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.code.gson:gson:2.10.1")

    // Logos dos canais
    implementation("io.coil-kt:coil-compose:2.7.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
