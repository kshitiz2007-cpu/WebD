FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive ANDROID_HOME=/opt/android-sdk ANDROID_SDK_ROOT=/opt/android-sdk PATH=/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/emulator:/usr/local/bin:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jdk curl unzip zip git python3 python3-pip xvfb x11vnc websockify netcat-openbsd && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /opt/android-sdk/cmdline-tools && curl -fsSL https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o /tmp/cmdtools.zip && unzip -q /tmp/cmdtools.zip -d /tmp/cmdtools && mkdir -p /opt/android-sdk/cmdline-tools/latest && mv /tmp/cmdtools/cmdline-tools/* /opt/android-sdk/cmdline-tools/latest/ && rm -rf /tmp/cmdtools /tmp/cmdtools.zip
RUN yes | sdkmanager --licenses >/dev/null 2>&1 || true && sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0" "emulator" "system-images;android-35;google_apis;x86_64"
RUN echo no | avdmanager create avd -n WebD_API_35 -k "system-images;android-35;google_apis;x86_64" -d pixel_6 || true
RUN pip3 install --break-system-packages --no-cache-dir fastapi uvicorn websockets
RUN useradd -m -u 10001 worker && mkdir -p /app /tmp/webd-emulator && chown -R worker:worker /app /tmp/webd-emulator
WORKDIR /app
COPY main.py /app/main.py
USER worker
ENV ANDROID_EMULATOR_TOKEN="" AVD_NAME=WebD_API_35
EXPOSE 8080 6080
CMD ["bash","-lc","websockify --web=/usr/share/novnc 6080 127.0.0.1:5900 >/tmp/websockify.log 2>&1 & uvicorn main:app --host 0.0.0.0 --port 8080"]
