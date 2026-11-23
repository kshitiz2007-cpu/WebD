FROM python:3.12-slim
ENV DEBIAN_FRONTEND=noninteractive ANDROID_HOME=/opt/android-sdk ANDROID_SDK_ROOT=/opt/android-sdk PATH=/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/usr/local/bin:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jdk curl unzip zip git && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /opt/android-sdk/cmdline-tools && curl -fsSL https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o /tmp/cmdtools.zip && unzip -q /tmp/cmdtools.zip -d /tmp/cmdtools && mkdir -p /opt/android-sdk/cmdline-tools/latest && mv /tmp/cmdtools/cmdline-tools/* /opt/android-sdk/cmdline-tools/latest/ && rm -rf /tmp/cmdtools /tmp/cmdtools.zip
RUN yes | sdkmanager --licenses >/dev/null 2>&1 || true && sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
RUN curl -fsSL https://services.gradle.org/distributions/gradle-8.9-bin.zip -o /tmp/gradle.zip && unzip -q /tmp/gradle.zip -d /opt && rm /tmp/gradle.zip && ln -s /opt/gradle-8.9/bin/gradle /usr/local/bin/gradle
RUN pip install --no-cache-dir fastapi uvicorn
WORKDIR /app
COPY main.py /app/main.py
ENV ANDROID_BUILD_TOKEN=""
ENV BUILD_TIMEOUT_SECONDS=240
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
