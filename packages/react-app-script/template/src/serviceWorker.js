// https://developers.google.com/web/fundamentals/codelabs/your-first-pwapp/?hl=zh-cn
const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    // [::1] is the IPv6 localhost address.
    window.location.hostname === '[::1]' ||
    // 127.0.0.1/8 is considered localhost for IPv4.
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
    )
);

export function register(config) {
  // 如果当前是产品环境且浏览器支持 service worker 那么就进行注册操作
  // 之所以要是产品环境是因为开发环境总是进行缓存那么开发者要频繁的清空缓存才能获取最新的内容，这样不利于快速开发
  // 如果浏览器不支持 service worker 那么巧妇难为无米之炊，只能放弃注册
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
    if (publicUrl.origin !== window.location.origin) {
      return;
    }
    // 当页面加载完毕之后才执行 service worker 的一番操作，主要是为了避免阻塞页面的加载
    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;
      // 如果是本地环境进行访问的，那么
      if (isLocalhost) {
        checkValidServiceWorker(swUrl, config);

        navigator.serviceWorker.ready.then(() => {
          console.log(
            'This web app is being served cache-first by a service ' + 'worker.'
          );
        });
      } else {
        // 如果不是本地地址，那么只注册 service worker
        // 这样做是因为此时已不再是开发环境了，开发者已经将其暴露在外网（网内网）环境中，其它用户已经可以对其进行访问了
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then(registration => {
      // service-worker发生改变时触发的事件
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log(
                'New content is available and will be used when all ' +
                  'tabs for this page are closed.'
              );

              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              console.log('Content is cached for offline use.');
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch(error => {
      console.error('Error during service worker registration:', error);
    });
}

// 检查 service worker 的状态
// 向 service worker 的后台服务申请资源，如果网络连接失败，
// 或者没有获取到 javascript 那么当 service worker 状态就绪的时候取消其注册状态，
// 并重新加载页面，如果申请到资源，那么就调用 registerValidSW 方法来进行加载。
function checkValidServiceWorker(swUrl, config) {
  fetch(swUrl)
    .then(response => {
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        navigator.serviceWorker.ready.then(registration => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log(
        'No internet connection found. App is running in offline mode.'
      );
    });
}

// 取消 service worker 的注册
export function unregister() {
  // 如果浏览器支持 service worker 且 service worker 处于就绪状态的时候，那么调用其提供的取消注册方法来进行操作 
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.unregister();
    });
  }
}
