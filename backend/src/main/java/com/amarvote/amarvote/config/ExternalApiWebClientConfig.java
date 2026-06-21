package com.amarvote.amarvote.config;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.core5.util.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

/**
 * External HTTP clients.
 * ElectionGuard API and Worker are separate containers with independent connection pools.
 */
@Configuration
public class ExternalApiWebClientConfig {

    @Value("${electionguard.api.max.connections:6}")
    private int electionGuardApiMaxConnections;

    @Value("${electionguard.api.max.per.route:6}")
    private int electionGuardApiMaxPerRoute;

    @Value("${electionguard.worker.max.connections:6}")
    private int electionGuardWorkerMaxConnections;

    @Value("${electionguard.worker.max.per.route:6}")
    private int electionGuardWorkerMaxPerRoute;

    @Value("${electionguard.connection.request.timeout:60000}")
    private int electionGuardConnectionRequestTimeoutMs;

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .requestFactory(() -> {
                    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
                    factory.setConnectTimeout(30000);
                    factory.setReadTimeout(300000);
                    return factory;
                })
                .build();
    }

    /** Fast ballot/guardian calls → electionguard-api:5000 */
    @Bean("electionGuardApiRestTemplate")
    public RestTemplate electionGuardApiRestTemplate(
            @Autowired @Qualifier("electionGuardInternalAuthInterceptor")
            ClientHttpRequestInterceptor electionGuardInternalAuthInterceptor) {
        return buildElectionGuardRestTemplate(
                electionGuardApiMaxConnections,
                electionGuardApiMaxPerRoute,
                Timeout.ofMinutes(5),
                electionGuardInternalAuthInterceptor);
    }

    /** Heavy tally/decrypt/combine → electionguard-worker:5001 */
    @Bean("electionGuardWorkerRestTemplate")
    public RestTemplate electionGuardWorkerRestTemplate(
            @Autowired @Qualifier("electionGuardInternalAuthInterceptor")
            ClientHttpRequestInterceptor electionGuardInternalAuthInterceptor) {
        return buildElectionGuardRestTemplate(
                electionGuardWorkerMaxConnections,
                electionGuardWorkerMaxPerRoute,
                Timeout.ofMinutes(10),
                electionGuardInternalAuthInterceptor);
    }

    private RestTemplate buildElectionGuardRestTemplate(
            int maxConnections,
            int maxPerRoute,
            Timeout responseTimeout,
            ClientHttpRequestInterceptor interceptor) {
        PoolingHttpClientConnectionManager connectionManager = new PoolingHttpClientConnectionManager();
        connectionManager.setMaxTotal(maxConnections);
        connectionManager.setDefaultMaxPerRoute(maxPerRoute);

        ConnectionConfig connectionConfig = ConnectionConfig.custom()
                .setConnectTimeout(Timeout.ofSeconds(30))
                .setSocketTimeout(responseTimeout)
                .build();
        connectionManager.setDefaultConnectionConfig(connectionConfig);

        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectionRequestTimeout(Timeout.ofMilliseconds(electionGuardConnectionRequestTimeoutMs))
                .setResponseTimeout(responseTimeout)
                .build();

        CloseableHttpClient httpClient = HttpClients.custom()
                .setConnectionManager(connectionManager)
                .setDefaultRequestConfig(requestConfig)
                .evictIdleConnections(Timeout.ofMinutes(2))
                .build();

        HttpComponentsClientHttpRequestFactory requestFactory =
                new HttpComponentsClientHttpRequestFactory(httpClient);

        RestTemplate restTemplate = new RestTemplate(requestFactory);
        restTemplate.setInterceptors(java.util.List.of(interceptor));
        return restTemplate;
    }

    @Bean
    public WebClient webClient() {
        ConnectionProvider connectionProvider = ConnectionProvider.builder("external-api")
                .maxConnections(50)
                .maxIdleTime(Duration.ofSeconds(120))
                .maxLifeTime(Duration.ofSeconds(300))
                .pendingAcquireTimeout(Duration.ofSeconds(60))
                .evictInBackground(Duration.ofSeconds(120))
                .build();

        ExchangeStrategies exchangeStrategies = ExchangeStrategies.builder()
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(10485760))
                .build();

        HttpClient httpClient = HttpClient.create(connectionProvider)
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 30000)
                .responseTimeout(Duration.ofSeconds(300))
                .doOnConnected(conn ->
                    conn.addHandlerLast(new ReadTimeoutHandler(300, TimeUnit.SECONDS))
                        .addHandlerLast(new WriteTimeoutHandler(300, TimeUnit.SECONDS))
                )
                .keepAlive(true);

        return WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .exchangeStrategies(exchangeStrategies)
                .build();
    }
}
