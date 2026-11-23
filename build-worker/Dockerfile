FROM python:3.12-slim-bookworm
ENV DEBIAN_FRONTEND=noninteractive ANDROID_HOME=/opt/android-sdk ANDROID_SDK_ROOT=/opt/android-sdk PATH=/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/usr/local/bin:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jdk curl unzip zip git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 10001 builder && mkdir -p /opt/android-sdk/cmdline-tools /gradle-cache /app && chown -R builder:builder /opt/android-sdk /gradle-cache /app
RUN curl -fsSL https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o /tmp/cmdtools.zip && unzip -q /tmp/cmdtools.zip -d /tmp/cmdtools && mkdir -p /opt/android-sdk/cmdline-tools/latest && mv /tmp/cmdtools/cmdline-tools/* /opt/android-sdk/cmdline-tools/latest/ && rm -rf /tmp/cmdtools /tmp/cmdtools.zip && chown -R builder:builder /opt/android-sdk
USER builder
RUN yes | sdkmanager --licenses >/dev/null 2>&1 || true && sdkmanager "platform-tools" "platforms;android-34" "platforms;android-35" "build-tools;34.0.0" "build-tools;35.0.0"
USER root
RUN curl -fsSL https://services.gradle.org/distributions/gradle-8.9-bin.zip -o /tmp/gradle.zip && unzip -q /tmp/gradle.zip -d /opt && rm /tmp/gradle.zip && ln -s /opt/gradle-8.9/bin/gradle /usr/local/bin/gradle && chown -R builder:builder /opt/android-sdk /gradle-cache /app && chmod -R u+rwX /opt/android-sdk
RUN pip install --no-cache-dir fastapi uvicorn
WORKDIR /app
COPY main.py /app/main.py
RUN chown builder:builder /app/main.py
USER builder
ENV ANDROID_BUILD_TOKEN=""
ENV BUILD_TIMEOUT_SECONDS=240
ENV GRADLE_USER_HOME=/gradle-cache
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
