package com.amarvote.amarvote;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@ComponentScan(basePackages = {"com.amarvote.amarvote", "com.amarvote.blockchain"})
public class AmarvoteApplication {

	public static void main(String[] args) {
		SpringApplication.run(AmarvoteApplication.class, args);
	}

}
